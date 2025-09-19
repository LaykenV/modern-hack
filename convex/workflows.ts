// Workflow Manager - Initialize Convex Workflows
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

// Export the workflow manager with enhanced configuration
export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { 
    maxParallelism: 2 
  }
});
