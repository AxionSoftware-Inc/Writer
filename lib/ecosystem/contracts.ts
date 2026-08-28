// Temporary app-local mirror of the canonical ecosystem contract.
// Canonical semantics live in Problem-library/docs/SCIENTIFIC_OBJECT_SPEC.md.
// Keep this file renderer- and backend-independent so it can later move into
// a published @axion/science-contract package without changing app logic.

export const SCIENTIFIC_OBJECT_SCHEMA_VERSION = "1.0" as const;

export type EcosystemAppId = "science" | "library" | "math" | "notebook" | "writer" | "physics" | (string & {});
export type ScientificReferenceMode = "live" | "pinned" | "frozen";
export type ExecutionTarget = "this-device" | "local-python" | "jupyter-kernel" | "external-server" | "hpc-cluster" | (string & {});
export type ScientificObjectKind =
  | "problem" | "solution" | "equation" | "model" | "calculation" | "simulation"
  | "dataset" | "visualization" | "scene" | "notebook" | "hypothesis" | "observation"
  | "finding" | "decision" | "document" | "publication" | (string & {});

export interface ProjectRef { id: string; title: string; slug?: string; }

export interface ScientificObjectReference {
  projectId: string;
  objectId: string;
  mode: ScientificReferenceMode;
  revision?: number;
  snapshotId?: string;
}

export interface ScientificArtifact {
  id?: string;
  role: string;
  mediaType?: string;
  uri: string;
  contentHash?: string;
  metadata?: Record<string, unknown>;
}

export interface ScientificProvenance {
  sourceApp: EcosystemAppId;
  engine?: string;
  engineVersion?: string;
  executionTarget?: ExecutionTarget;
  inputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
  assumptions?: unknown[];
  parentObjects?: ScientificObjectReference[];
  startedAt?: string;
  finishedAt?: string;
  [key: string]: unknown;
}

export interface ScientificObjectRevision<TPayload = unknown> {
  objectId: string;
  revision: number;
  payload: TPayload;
  provenance: ScientificProvenance;
  artifacts?: ScientificArtifact[];
  contentHash?: string;
  createdAt?: string;
}

export interface ScientificObject<TPayload = unknown> {
  id: string;
  projectId: string;
  kind: ScientificObjectKind;
  domain?: string;
  schemaVersion: string;
  title: string;
  sourceApp: EcosystemAppId;
  currentRevision: number;
  metadata?: Record<string, unknown>;
  revision?: ScientificObjectRevision<TPayload>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScientificSceneLayer {
  id: string;
  kind: "curve" | "surface" | "mesh" | "point-cloud" | "scalar-field" | "vector-field" | "trajectory" | "region" | "annotation" | (string & {});
  source?: ScientificObjectReference;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface ScientificSceneSpec {
  version: "1.0" | (string & {});
  dimension: "2d" | "3d";
  coordinateSystem?: string;
  layers: ScientificSceneLayer[];
  annotations?: unknown[];
  controls?: unknown[];
  time?: Record<string, unknown>;
  camera?: Record<string, unknown>;
  sourceRefs?: ScientificObjectReference[];
  adapterMetadata?: Record<string, unknown>;
}
