-- CreateTable
CREATE TABLE "LineAccount" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pending_project_id" TEXT,
    "pending_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineLinkToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectIssue" (
    "id" TEXT NOT NULL,
    "issue_code" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "reported_by_id" TEXT,
    "reporter_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "line_message_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineAccount_user_id_key" ON "LineAccount"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "LineAccount_line_user_id_key" ON "LineAccount"("line_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "LineLinkToken_token_key" ON "LineLinkToken"("token");

-- CreateIndex
CREATE INDEX "LineLinkToken_user_id_idx" ON "LineLinkToken"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIssue_issue_code_key" ON "ProjectIssue"("issue_code");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectIssue_line_message_id_key" ON "ProjectIssue"("line_message_id");

-- CreateIndex
CREATE INDEX "ProjectIssue_project_id_idx" ON "ProjectIssue"("project_id");

-- CreateIndex
CREATE INDEX "ProjectIssue_status_idx" ON "ProjectIssue"("status");

-- AddForeignKey
ALTER TABLE "LineAccount" ADD CONSTRAINT "LineAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineLinkToken" ADD CONSTRAINT "LineLinkToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
