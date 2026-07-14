import { socialLinks } from "@/lib/footer-config";

export function SocialLinks() {
  return (
    <ul className="flex items-center gap-3">
      {socialLinks.map((social) => (
        <li key={social.label}>
          <a
            href={social.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="inline-flex size-9 items-center justify-center rounded-full text-ivory/80 hover:bg-ivory/10 hover:text-ivory"
          >
            <social.icon className="size-5" />
          </a>
        </li>
      ))}
    </ul>
  );
}
