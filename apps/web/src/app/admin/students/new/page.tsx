import { StudentForm } from '@/features/students/student-form';

export default function NewStudentPage() {
  return <StudentForm mode="create" basePath="/admin" />;
}
