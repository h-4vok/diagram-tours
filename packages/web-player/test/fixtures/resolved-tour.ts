import type { ResolvedDiagramTour } from "@diagram-tour/core";

export const resolvedPaymentFlowTour: ResolvedDiagramTour = {
  sourceKind: "authored",
  version: 1,
  title: "Payment Flow",
  diagram: {
    elements: [
      { id: "client", kind: "node", label: "Client" },
      { id: "api_gateway", kind: "node", label: "API Gateway" },
      { id: "validation_service", kind: "node", label: "Validation Service" },
      { id: "payment_service", kind: "node", label: "Payment Service" },
      { id: "payment_provider", kind: "node", label: "Payment Provider" },
      { id: "response", kind: "node", label: "Response" }
    ],
    path: "./checkout-payment-flow.mmd",
    source: `flowchart LR
  client[Client] --> api_gateway[API Gateway]
  api_gateway --> validation_service[Validation Service]
  validation_service --> payment_service[Payment Service]
  payment_service --> payment_provider[Payment Provider]
  payment_provider --> response[Response]`,
    type: "flowchart"
  },
  steps: [
    {
      index: 1,
      focus: [{ id: "api_gateway", kind: "node", label: "API Gateway" }],
      text: "The API Gateway is the public edge of the checkout system. It receives untrusted traffic from Client and normalizes the request before any payment work begins."
    },
    {
      index: 2,
      focus: [{ id: "validation_service", kind: "node", label: "Validation Service" }],
      text: "The Validation Service protects the payment path by rejecting malformed amounts, expired intents, and requests that do not match business rules before they reach Payment Service."
    },
    {
      index: 3,
      focus: [
        { id: "payment_service", kind: "node", label: "Payment Service" },
        { id: "payment_provider", kind: "node", label: "Payment Provider" }
      ],
      text: "The Payment Service owns the merchant-side transaction state while Payment Provider talks to the banking network. This split lets the product keep internal business logic separate from external settlement concerns."
    },
    {
      index: 4,
      focus: [{ id: "response", kind: "node", label: "Response" }],
      text: "Once the provider result is known, the platform turns it into a stable Response that the client can render without needing to understand provider-specific outcomes."
    }
  ]
};
