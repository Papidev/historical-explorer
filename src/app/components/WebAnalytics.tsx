"use client";

import { Analytics } from "@vercel/analytics/next";

export const WebAnalytics = () => (
  <Analytics beforeSend={(event) => (localStorage.getItem("va-disable") ? null : event)} />
);
