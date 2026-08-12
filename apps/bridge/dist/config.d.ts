export interface SwarmPaths {
    logDir: string;
    agentsDir: string;
    stateFile: string;
}
export interface AgentSpec {
    id: string;
    runtime: string;
    model: string;
    tokenEnv: string;
    primaryChannel: string;
}
export interface BridgeConfig {
    root: string;
    channels: Map<string, string>;
    agents: Map<string, AgentSpec>;
    control: {
        humanGateChannel: string;
        neverRun: string[];
        runTimeoutSeconds: number;
    };
    paths: SwarmPaths;
    secrets: Map<string, string>;
}
export declare function loadConfig(root?: string): BridgeConfig;
