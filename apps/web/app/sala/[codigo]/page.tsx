import { RoomApp } from "@/components/RoomApp";

export default async function SalaPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  return <RoomApp code={codigo} />;
}
