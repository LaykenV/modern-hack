type Props = {
  params: { callId: string };
};

export default function CallWorkspacePage({ params }: Props) {
  return <div>Call Workspace: {params.callId}</div>;
}


