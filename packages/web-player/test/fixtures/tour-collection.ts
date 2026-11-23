import type {
  ResolvedDiagramTour,
  ResolvedDiagramTourCollection
} from "@diagram-tour/core";

import { resolvedPaymentFlowTour } from "./resolved-tour";

export const resolvedPaymentsPlatformTour: ResolvedDiagramTour = {
  sourceKind: "authored",
  version: 1,
  title: "Payments Platform Overview",
  diagram: {
    elements: [
      { id: "edge_gateway", kind: "node", label: "Edge Gateway" },
      { id: "checkout_orchestrator", kind: "node", label: "Checkout Orchestrator" },
      { id: "payment_service", kind: "node", label: "Payment Service" },
      { id: "event_bus", kind: "node", label: "Event Bus" }
    ],
    path: "./payments-platform-overview.mmd",
    source: `flowchart LR
  edge_gateway[Edge Gateway] --> checkout_orchestrator[Checkout Orchestrator]
  checkout_orchestrator --> payment_service[Payment Service]
  payment_service --> event_bus[Event Bus]`,
    type: "flowchart"
  },
  steps: [
    {
      index: 1,
      focus: [{ id: "checkout_orchestrator", kind: "node", label: "Checkout Orchestrator" }],
      text: "The Checkout Orchestrator coordinates payment and order concerns before charging the customer."
    },
    {
      index: 2,
      focus: [{ id: "payment_service", kind: "node", label: "Payment Service" }],
      text: "The Payment Service records durable payment outcomes and publishes downstream events."
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
      slug: "payments-platform-overview",
      sourcePath: "payments-platform-overview/payments-platform-overview.tour.yaml",
      title: "Payments Platform Overview",
      tour: resolvedPaymentsPlatformTour
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
      slug: "payments-platform-overview",
      sourcePath: "payments/platform/payments-platform-overview/payments-platform-overview.tour.yaml",
      title: "Payments Platform Overview",
      tour: resolvedPaymentsPlatformTour
    }
  ],
  skipped: []
};

export const singleTourCollection: ResolvedDiagramTourCollection = {
  entries: [resolvedTourCollection.entries[0]],
  skipped: []
};
