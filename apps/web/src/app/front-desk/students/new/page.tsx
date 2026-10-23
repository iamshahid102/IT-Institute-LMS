import { StudentForm } from '@/features/students/student-form';

export default function NewAdmissionPage() {
  return <StudentForm mode="create" basePath="/front-desk" />;
}
