-- DropIndex
DROP INDEX "Project_repoUrl_key";

-- CreateIndex
CREATE UNIQUE INDEX "Project_importedByUserId_repoUrl_key" ON "Project"("importedByUserId", "repoUrl");
