import { writePublicCatalog } from "../src/server/publicCatalog/build";

writePublicCatalog()
  .then(({ pois, people }) => console.log(`Built public catalog: ${pois} POIs, ${people} People.`))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
