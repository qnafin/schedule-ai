import type { User } from '../user';
import type { Users } from './getUsers';

export type Sender = {
  vkId: number;
  role: 'student' | 'teacher';
  fullName: string;
  id: string;
};

export const resolveByVkId = (users: Users, vkId: number): Sender | null => {
  const matches = (u: User) => u.vk?.type === 'id' && u.vk.value === vkId;

  const teacher = users.teachers.find(matches);
  if (teacher) {
    return { vkId, role: 'teacher', fullName: teacher.fullName, id: teacher.id };
  }
  
  const student = users.students.find(matches);
  if (student) {
    return { vkId, role: 'student', fullName: student.fullName, id: student.id };
  }

  

  return null;
};