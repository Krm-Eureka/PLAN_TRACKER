-- CreateTable
CREATE TABLE "TaskAssignee" (
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateTable
CREATE TABLE "ProjectDepartment" (
    "project_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,

    CONSTRAINT "ProjectDepartment_pkey" PRIMARY KEY ("project_id","department_id")
);

-- CreateTable
CREATE TABLE "PlanMember" (
    "plan_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "PlanMember_pkey" PRIMARY KEY ("plan_id","user_id")
);

-- CreateIndex
CREATE INDEX "TaskAssignee_user_id_idx" ON "TaskAssignee"("user_id");

-- CreateIndex
CREATE INDEX "ProjectDepartment_department_id_idx" ON "ProjectDepartment"("department_id");

-- CreateIndex
CREATE INDEX "PlanMember_user_id_idx" ON "PlanMember"("user_id");

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDepartment" ADD CONSTRAINT "ProjectDepartment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDepartment" ADD CONSTRAINT "ProjectDepartment_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "Department"("department_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMember" ADD CONSTRAINT "PlanMember_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMember" ADD CONSTRAINT "PlanMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

