"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  Link2,
  MessageCircle,
  Send,
  Unlink,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api as axios } from "@/lib/axios";
import { showToast } from "@/utils/toast";

export interface LineLinkStatus {
  linked: boolean;
  lineDisplayName: string | null;
  linkedAt: string | null;
  oaBasicId?: string | null;
  activeToken: {
    token: string;
    expiresAt: string;
  } | null;
}

function buildLineAddFriendUrl(oaBasicId?: string | null): string | null {
  if (!oaBasicId) return null;
  const normalized = oaBasicId.startsWith("@") ? oaBasicId : `@${oaBasicId}`;
  return `https://line.me/R/ti/p/${encodeURIComponent(normalized)}`;
}

function buildLinePrefilledChatUrl(
  oaBasicId?: string | null,
  token?: string | null
): string | null {
  if (!oaBasicId || !token) return null;
  const normalized = oaBasicId.startsWith("@") ? oaBasicId : `@${oaBasicId}`;
  return `https://line.me/R/oaMessage/${encodeURIComponent(normalized)}/?${encodeURIComponent(token)}`;
}

export function LineConnectCard({
  initialStatus,
}: {
  initialStatus: LineLinkStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<LineLinkStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const addFriendUrl = buildLineAddFriendUrl(status.oaBasicId);
  const prefilledChatUrl = buildLinePrefilledChatUrl(
    status.oaBasicId,
    status.activeToken?.token
  );

  const handleGenerateCode = async () => {
    setLoading(true);
    try {
      const res = await axios.post("/api/line/link");
      if (res.data?.status === "success") {
        const nextOaId = res.data.data.oaBasicId ?? status.oaBasicId ?? null;
        setStatus((prev) => ({
          ...prev,
          oaBasicId: nextOaId,
          activeToken: {
            token: res.data.data.token,
            expiresAt: res.data.data.expiresAt,
          },
        }));
        window.dispatchEvent(new Event("line-link-updated"));
        showToast.success("สร้างรหัสเชื่อมต่อ LINE OA แล้ว", "รหัสมีอายุ 5 นาที");

        const targetUrl = buildLineAddFriendUrl(nextOaId);
        if (targetUrl) {
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      }
    } catch {
      showToast.error("ไม่สามารถสร้างรหัสเชื่อมต่อได้");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    setLoading(true);
    try {
      const res = await axios.delete("/api/line/link");
      if (res.data?.status === "success") {
        setStatus((prev) => ({
          linked: false,
          lineDisplayName: null,
          linkedAt: null,
          oaBasicId: prev.oaBasicId,
          activeToken: null,
        }));
        sessionStorage.removeItem("line-link-reminder-dismissed");
        window.dispatchEvent(new Event("line-link-updated"));
        showToast.success("ยกเลิกการเชื่อมต่อ LINE OA แล้ว");
        router.refresh();
      }
    } catch {
      showToast.error("ไม่สามารถยกเลิกการเชื่อมต่อได้");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast.error("คัดลอกไม่สำเร็จ");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            เชื่อมต่อ LINE OA
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              status.linked
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }`}
          >
            {status.linked ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {status.linked ? (
          <div className="space-y-3">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2">
              <dt className="text-slate-500">ชื่อ LINE</dt>
              <dd className="font-medium text-slate-800">
                {status.lineDisplayName || "LINE User"}
              </dd>
              <dt className="text-slate-500">เชื่อมต่อเมื่อ</dt>
              <dd className="text-slate-700">
                {status.linkedAt
                  ? new Date(status.linkedAt).toLocaleString("th-TH")
                  : "-"}
              </dd>
            </dl>
            <p className="text-xs text-slate-500">
              ใช้งานใน LINE OA ได้ทันที: พิมพ์{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">งานของฉัน</code>{" "}
              เพื่อดู/เปลี่ยนสถานะงาน หรือพิมพ์{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">
                รหัสโปรเจกต์ รายละเอียดปัญหา
              </code>{" "}
              เพื่อแจ้งปัญหา
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleUnlink}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <Unlink className="w-4 h-4 mr-1.5" />
              ยกเลิกการเชื่อมต่อ
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-600">
              เชื่อมต่อบัญชีบริษัทกับ LINE OA เพื่อรับแจ้งปัญหาและอัปเดตสถานะงานจากมือถือโดยตรง
            </p>
            {status.activeToken ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 space-y-2.5">
                <div className="text-xs text-emerald-800 font-medium">
                  1) เพิ่มเพื่อน LINE OA (ถ้ายังไม่เคยแอด) แล้วส่งรหัสนี้เข้าแชตภายใน 5 นาที:
                </div>
                <div className="flex items-center justify-between gap-2 rounded-md bg-white border border-emerald-200 px-3 py-2">
                  <code className="text-base font-bold tracking-wider text-emerald-700">
                    {status.activeToken.token}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(status.activeToken!.token)}
                    className="h-7 px-2 text-emerald-700"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" /> คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> คัดลอก
                      </>
                    )}
                  </Button>
                </div>

                {(addFriendUrl || prefilledChatUrl) && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {addFriendUrl && (
                      <a
                        href={addFriendUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        เพิ่มเพื่อน LINE OA
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {prefilledChatUrl && (
                      <a
                        href={prefilledChatUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        เปิดแชตส่งรหัส
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-emerald-700">
                  หมดอายุเวลา{" "}
                  {new Date(status.activeToken.expiresAt).toLocaleTimeString(
                    "th-TH"
                  )}
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={loading}
                onClick={handleGenerateCode}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Link2 className="w-4 h-4 mr-1.5" />
                {status.activeToken
                  ? "สร้างรหัสใหม่"
                  : addFriendUrl
                  ? "เชื่อมต่อ & เพิ่มเพื่อน LINE OA"
                  : "สร้างรหัสเชื่อมต่อ LINE OA"}
              </Button>
              {!status.activeToken && addFriendUrl && (
                <a
                  href={addFriendUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  เพิ่มเพื่อน LINE OA
                </a>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
