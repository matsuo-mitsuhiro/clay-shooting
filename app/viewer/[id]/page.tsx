import ViewerPage from '@/components/viewer/ViewerPage';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ViewerPage tournamentId={Number(id)} />;
}
