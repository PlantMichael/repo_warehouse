-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "license" TEXT,
ADD COLUMN     "topics" TEXT,
ADD COLUMN     "openIssues" INTEGER,
ADD COLUMN     "repoUpdatedAt" TIMESTAMP(3);
