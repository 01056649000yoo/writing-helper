import { StudentLabNavigation } from "@/components/student-lab-navigation";

export default function StudentRoomLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StudentLabNavigation />
      {children}
    </>
  );
}
