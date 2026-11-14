import React, { useEffect, useState } from "react";
import {
  CreditCardIcon,
  FileTextIcon,
  GlobeIcon,
  UserCheckIcon,
} from "@animateicons/react/lucide";
import { getFaviconUrl } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { CipherView } from "../../types/vault";

interface CipherIconProps {
  cipher: CipherView;
  size?: number;
}

export const CipherIcon: React.FC<CipherIconProps> = ({
  cipher,
  size = 16,
}) => {
  const showFavicons = useSettingsStore((s) => s.showFavicons);
  const serverUrl = useAuthStore((s) => s.serverUrl);
  const [imageFailed, setImageFailed] = useState(false);

  const firstUri = cipher.type === 1 ? cipher.login?.uris[0]?.uri : null;
  const faviconUrl =
    cipher.type === 1 && showFavicons
      ? getFaviconUrl(firstUri, serverUrl)
      : null;

  useEffect(() => {
    setImageFailed(false);
  }, [faviconUrl]);

  if (faviconUrl && !imageFailed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="rounded-sm object-contain"
      />
    );
  }

  switch (cipher.type) {
    case 1:
      return <GlobeIcon size={size} className="text-brand-400" />;
    case 2:
      return <FileTextIcon size={size} className="text-emerald-400" />;
    case 3:
      return <CreditCardIcon size={size} className="text-purple-400" />;
    case 4:
      return <UserCheckIcon size={size} className="text-amber-400" />;
    default:
      return <GlobeIcon size={size} className="text-slate-400" />;
  }
};
