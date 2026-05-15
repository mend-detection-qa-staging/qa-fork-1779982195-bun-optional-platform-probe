// Minimal stub — satisfies the "there is a source file" requirement.
// This probe exercises Mend SCA's handling of platform-conditional
// optionalDependencies. No application logic is required.
import * as esbuild from "esbuild";

// Reference esbuild so the module is not tree-shaken away by type-checkers.
export { esbuild };
