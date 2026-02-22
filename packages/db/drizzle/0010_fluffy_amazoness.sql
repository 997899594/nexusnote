-- Add status and currentStep fields to course_profiles table
-- These fields support course lifecycle management and progress tracking

-- Add status field for course lifecycle management
ALTER TABLE "course_profiles" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'idle';

-- Add currentStep field for progress tracking (stores JSON data about current step)
ALTER TABLE "course_profiles" ADD COLUMN IF NOT EXISTS "current_step" jsonb;