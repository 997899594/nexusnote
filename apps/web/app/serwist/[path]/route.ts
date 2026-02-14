import path from "node:path";
import { createSerwistRoute } from "@serwist/turbopack";

export const dynamic = "force-static";

export const { generateStaticParams, GET } = createSerwistRoute({
  swSrc: path.join(process.cwd(), "src/app/sw.ts"),
  globDirectory: path.join(process.cwd(), ".next/static"),
  globPatterns: [
    "**/*.{js,css,html,ico,apng,png,avif,jpg,jpeg,gif,svg,webp,woff,woff2,ttf,eot,json,webmanifest}",
  ],
  globIgnores: [],
  injectionPoint: "self.__SW_MANIFEST",
  manifestTransforms: [
    (manifestEntries) => {
      const manifest = manifestEntries.map((m) => {
        m.url = `/_next/${m.url}`;
        return m;
      });
      return { manifest, warnings: [] };
    },
  ],
});
