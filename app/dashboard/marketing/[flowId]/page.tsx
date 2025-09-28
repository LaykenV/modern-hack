type Props = {
  params: { flowId: string };
};

export default function MarketingFlowPage({ params }: Props) {
  return <div>Marketing Flow: {params.flowId}</div>;
}


