interface JsonLdScriptProps {
  data: unknown;
}

/**
 * `JSON.stringify` doesn't escape `<`, so a value containing
 * `</script><script>` could break out of this block — replacing `<` with
 * its unicode escape neutralizes that without affecting the parsed JSON.
 */
export function JsonLdScript({ data }: JsonLdScriptProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
