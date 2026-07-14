import Image from "next/image";
import Link from "next/link";

import logo from "@/assets/logo/Logo.png";

export function Logo() {
  return (
    <Link href="/" aria-label="Oristor home" className="flex shrink-0 items-center gap-2">
      <Image src={logo} alt="" priority className="size-9 w-auto" sizes="36px" />
      <span className="font-heading text-h4 text-charcoal max-sm:hidden">OristorFoods</span>
    </Link>
  );
}
