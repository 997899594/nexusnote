import { discoverAndSaveSkills } from "@/lib/skills/discovery";

interface DiscoverSkillsWorkflowOptions {
  userId: string;
  limit?: number;
  sources?: Array<"conversations" | "knowledge" | "courses" | "flashcards">;
}

export async function runDiscoverSkillsWorkflow({
  userId,
  limit = 50,
  sources,
}: DiscoverSkillsWorkflowOptions) {
  const skills = await discoverAndSaveSkills(userId, {
    limit,
    sources,
  });

  return {
    success: true,
    count: skills.length,
    skills: skills.map((skill) => ({
      name: skill.name,
      slug: skill.slug,
      category: skill.category,
      confidence: skill.confidence,
    })),
  };
}
