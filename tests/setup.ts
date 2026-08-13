const url = process.env.DATABASE_URL ?? "";
if (!/test/i.test(url)) {
  throw new Error(
    "Refusing to run tests: DATABASE_URL is not a test database.\n" +
      `  got: ${url || "(unset)"}\n` +
      '  Expected a URL containing "test" (see .env.test). The suite truncates tables.',
  );
}
