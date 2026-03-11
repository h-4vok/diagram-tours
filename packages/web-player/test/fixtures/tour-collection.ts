import type {
  ResolvedDiagramTour,
  ResolvedDiagramTourCollection
} from "@diagram-tour/core";

import { resolvedPaymentFlowTour } from "./resolved-tour";

export const resolvedRefundFlowTour: ResolvedDiagramTour = {
  version: 1,
  title: "Refund Flow",
  diagram: {
    path: "./refund-flow.mmd",
    source: `flowchart LR
  customer[Customer] --> refund_service[Refund Service]
  refund_service --> payment_gateway[Payment Gateway]
  payment_gateway --> receipt[Receipt]`,
    nodes: [
      { id: "customer", label: "Customer" },
      { id: "refund_service", label: "Refund Service" },
      { id: "payment_gateway", label: "Payment Gateway" },
      { id: "receipt", label: "Receipt" }
    ]
  },
  steps: [
    {
      index: 1,
      focus: [{ id: "refund_service", label: "Refund Service" }],
      text: "The Refund Service receives the customer request."
    },
    {
      index: 2,
      focus: [{ id: "payment_gateway", label: "Payment Gateway" }],
      text: "The Payment Gateway authorizes the refund."
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

export const singleTourCollection: ResolvedDiagramTourCollection = {
  entries: [resolvedTourCollection.entries[0]],
  skipped: []
};
