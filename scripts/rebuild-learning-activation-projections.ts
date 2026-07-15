import { rebuildLearningActivationProjections } from "@/lib/learning/activation-projection";

await rebuildLearningActivationProjections();
console.log("learning activation projections rebuilt");
process.exit(0);
