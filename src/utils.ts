import { homedir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { AtlasOrganization, AtlasUser, AtlasViewer } from "@nomic-ai/atlas";
import { components } from "@nomic-ai/atlas/dist/type-gen/openapi";

export type ChatDatapoint = {
  id: string;
  model: string;
  created: number;
  tokens_completion: number;
  tokens_prompt: number;
  tokens_total: number;
  input: Array<{
    role: string;
    content: string;
  }>;
  output: {
    finish_reason: string;
    content: string;
    refusal: string | null;
  };
};

const getCredentialsPath = () => {
  const nomicDir = join(homedir(), ".nomic");
  const credentialsPath = join(nomicDir, "credentials");

  // Create .nomic directory if it doesn't exist
  if (!existsSync(nomicDir)) {
    mkdirSync(nomicDir);
  }

  return credentialsPath;
};

export type NomicCredentials = {
  token: string;
  apiUrl: string;
};

export const getNomicToken = (): NomicCredentials | null => {
  try {
    if (process.env.NOMIC_TOKEN) {
      const apiUrl = process.env.NOMIC_API_URL || "https://api-atlas.nomic.ai";
      return {
        token: process.env.NOMIC_TOKEN,
        apiUrl,
      };
    }
    const credentialsPath = getCredentialsPath();
    if (!existsSync(credentialsPath)) {
      return null;
    }

    const credentials = JSON.parse(readFileSync(credentialsPath, "utf-8"));
    if (!credentials.token) {
      return null;
    }
    return { token: credentials.token, apiUrl: credentials.apiUrl };
  } catch (error) {
    console.error("Error reading Nomic token:", error);
    return null;
  }
};

export const saveNomicToken = (token: string): void => {
  try {
    const credentialsPath = getCredentialsPath();
    const credentials = existsSync(credentialsPath)
      ? JSON.parse(readFileSync(credentialsPath, "utf-8"))
      : {};

    credentials.token = token;
    credentials.apiUrl =
      process.env.NOMIC_API_URL || "https://api-atlas.nomic.ai";
    writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2));
  } catch (error) {
    console.error("Error saving Nomic token:", error);
    throw error;
  }
};

export const getOrganizationSlug = async (
  creds: NomicCredentials
): Promise<string> => {
  // API Keys are only attached to one organization, so we just take the first org from the list.
  const viewer = new AtlasViewer({
    apiKey: creds.token,
    apiLocation: creds.apiUrl,
  });
  const user = await new AtlasUser(viewer).withLoadedAttributes();
  if (!user.attr.organizations) {
    throw new Error("User has no organizations");
  }
  return user.attr.organizations[0].slug;
};

const CONNECTOR_NAME = "llm-observer";

const createConnector = async (
  viewer: AtlasViewer,
  options: components["schemas"]["ConnectorCreateRequest"]
): Promise<components["schemas"]["ConnectorResponse"]> => {
  return viewer.apiCall(`/v1/connector/`, "POST", options) as Promise<
    components["schemas"]["ConnectorResponse"]
  >;
};

const createConnectorDataset = async (
  viewer: AtlasViewer,
  connectorId: string,
  options: components["schemas"]["ConnectorDatasetCreateRequest"]
): Promise<components["schemas"]["ConnectorDatasetResponse"]> => {
  return viewer.apiCall(`/v1/connector/${connectorId}/dataset`, "POST", {
    ...options,
  }) as Promise<components["schemas"]["ConnectorDatasetResponse"]>;
};

export const createDataset = async (name: string, creds: NomicCredentials) => {
  const viewer = new AtlasViewer({
    apiKey: creds.token,
    apiLocation: creds.apiUrl,
  });
  const user = await new AtlasUser(viewer).withLoadedAttributes();
  const orgId = user.attr.organizations?.[0]?.organization_id!;
  const org = await new AtlasOrganization(orgId, viewer).withLoadedAttributes();

  if (!("connectors" in org.attr)) {
    throw new Error("User does not have member access to this organization");
  }

  let observerConnector = org.attr.connectors.find(
    (c) => c.connector_name === CONNECTOR_NAME
  );

  // If it doesn't exist, create the connector
  if (!observerConnector) {
    observerConnector = await createConnector(viewer, {
      organization_id: org.id,
      connector_name: CONNECTOR_NAME,
      creation_params: {},
    });
  }

  const observerDataset = await createConnectorDataset(
    viewer,
    observerConnector.id,
    {
      connector_name: CONNECTOR_NAME,
      creation_params: {},
      create_dataset_params: {
        organization_id: org.id,
        project_name: name,
        description: "Dataset created by Atlas Observer",
        modality: "text",
        // TODO specify based on data structure
        unique_id_field: "row_number",
        // TODO default to set here
        is_public: false,
        is_public_to_org: true,
      },
    }
  );

  return observerDataset;
};

export const uploadDatapoint = async ({
  datasetId,
  point,
  creds,
}: {
  datasetId: string;
  point: ChatDatapoint;
  creds: NomicCredentials;
}) => {
  const viewer = new AtlasViewer({
    apiKey: creds.token,
    apiLocation: creds.apiUrl,
  });
};
