import type { MetadataRoute } from "next";
import { robotsPolicy } from "../lib/seo";

export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(process.env.NEXT_PUBLIC_SITE_URL);
}
