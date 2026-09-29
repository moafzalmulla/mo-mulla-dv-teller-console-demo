/*
 * The Deutsche Bank "slash in a square" mark, drawn inline so it needs no
 * asset file. Deutsche Blue on white, per the brand guidelines.
 */
export function DeutscheBankLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="db-logo"
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Deutsche Bank"
    >
      <path
        fill="var(--db-blue)"
        fillRule="evenodd"
        d="M0 0H100V100H0Z M12 12V88H88V12Z"
      />
      <path fill="var(--db-blue)" d="M22 78H38L78 38V22H62L22 62Z" />
    </svg>
  );
}
