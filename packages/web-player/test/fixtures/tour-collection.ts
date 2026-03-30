import type {
  ResolvedDiagramTour,
  ResolvedDiagramTourCollection
} from "@diagram-tour/core";

import { resolvedPaymentFlowTour } from "./resolved-tour";

export const resolvedRefundFlowTour: ResolvedDiagramTour = {
  sourceKind: "authored",
  version: 1,
  title: "Refund Flow",
  diagram: {
    elements: [
      { id: "customer", kind: "node", label: "Customer" },
      { id: "refund_service", kind: "node", label: "Refund Service" },
      { id: "payment_gateway", kind: "node", label: "Payment Gateway" },
      { id: "receipt", kind: "node", label: "Receipt" }
    ],
    path: "./checkout-refund-flow.mmd",
    source: `flowchart LR
  customer[Customer] --> refund_service[Refund Service]
  refund_service --> payment_gateway[Payment Gateway]
  payment_gateway --> receipt[Receipt]`,
    type: "flowchart"
  },
  steps: [
    {
      index: 1,
      focus: [{ id: "refund_service", kind: "node", label: "Refund Service" }],
      text: "The Refund Service is where customer support or self-service tools ask to reverse a payment. It records the refund intent and makes sure the request is tied to a real purchase from Customer."
    },
    {
      index: 2,
      focus: [{ id: "payment_gateway", kind: "node", label: "Payment Gateway" }],
      text: "The Payment Gateway executes the money movement with the processor. Only after that external confirmation arrives should the system issue the Receipt and tell the customer the refund is really underway."
    }
  ]
};

export const resolvedTourCollection: ResolvedDiagramTourCollection = {
  entries: [
    {
      slug: "payment-flow",
      sourcePath: "payment-flow/payment-flow.tour.yaml",
      title: "Payment Flow",
      tour: resolvedPaymentFlowTour
    },
    {
      slug: "refund-flow",
      sourcePath: "refund-flow/refund-flow.tour.yaml",
      title: "Refund Flow",
      tour: resolvedRefundFlowTour
    }
  ],
  skipped: []
};

export const nestedTourCollection: ResolvedDiagramTourCollection = {
  entries: [
    {
      slug: "payment-flow",
      sourcePath: "payments/core/payment-flow/payment-flow.tour.yaml",
      title: "Payment Flow",
      tour: resolvedPaymentFlowTour
    },
    {
      slug: "refund-flow",
      sourcePath: "payments/support/refund-flow/refund-flow.tour.yaml",
      title: "Refund Flow",
      tour: resolvedRefundFlowTour
    }
  ],
  skipped: []
};

export const singleTourCollection: ResolvedDiagramTourCollection = {
  entries: [resolvedTourCollection.entries[0]],
  skipped: []
};
