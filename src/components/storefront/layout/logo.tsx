import Image from "next/image";
import Link from "next/link";

import logo from "@/assets/logo/Logo.png";

export function Logo() {
  return (
    <Link href="/" aria-label="Oristor home" className="flex shrink-0 items-center gap-2.5">
      <Image src={logo} alt="" priority className="size-11 w-auto" sizes="44px" />
      <span className="font-heading text-h3 font-semibold tracking-tight text-charcoal max-sm:hidden">
        OristorFoods
      </span>
    </Link>
  );
}
