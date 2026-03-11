import type { ResolvedDiagramTour } from "@diagram-tour/core";

export const resolvedPaymentFlowTour: ResolvedDiagramTour = {
  version: 1,
  title: "Payment Flow",
  diagram: {
    path: "./payment-flow.mmd",
    source: `flowchart LR
  client[Client] --> api_gateway[API Gateway]
  api_gateway --> validation_service[Validation Service]
  validation_service --> payment_service[Payment Service]
  payment_service --> payment_provider[Payment Provider]
  payment_provider --> response[Response]`,
    nodes: [
      { id: "client", label: "Client" },
      { id: "api_gateway", label: "API Gateway" },
      { id: "validation_service", label: "Validation Service" },
      { id: "payment_service", label: "Payment Service" },
      { id: "payment_provider", label: "Payment Provider" },
      { id: "response", label: "Response" }
    ]
  },
  steps: [
    {
      index: 1,
      focus: [{ id: "api_gateway", label: "API Gateway" }],
      text: "The API Gateway is the public entry point for incoming requests from Client."
    },
    {
      index: 2,
      focus: [{ id: "validation_service", label: "Validation Service" }],
      text: "The Validation Service checks the request before it moves to Payment Service."
    },
    {
      index: 3,
      focus: [
        { id: "payment_service", label: "Payment Service" },
        { id: "payment_provider", label: "Payment Provider" }
      ],
      text: "The Payment Service coordinates the transaction with Payment Provider."
    },
    {
      index: 4,
      focus: [{ id: "response", label: "Response" }],
      text: "Finally, the system returns the result in Response."
    }
  ]
};
