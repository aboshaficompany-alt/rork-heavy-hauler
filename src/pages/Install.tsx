import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Apple, Chrome } from "lucide-react";
import { Helmet } from "react-helmet";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <>
      <Helmet>
        <title>تثبيت التطبيق - حمّل</title>
        <meta name="description" content="ثبّت تطبيق حمّل على جهازك للوصول السريع" />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
              <img src="/logo.jpg" alt="حمّل" className="w-full h-full object-cover" />
            </div>
            <CardTitle className="text-2xl">تثبيت تطبيق حمّل</CardTitle>
            <CardDescription>
              ثبّت التطبيق على جهازك للوصول السريع والعمل بدون إنترنت
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isInstalled ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <Download className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-green-600 font-medium">التطبيق مثبت بالفعل!</p>
                <p className="text-muted-foreground text-sm mt-2">
                  يمكنك فتح التطبيق من الشاشة الرئيسية
                </p>
              </div>
            ) : isIOS ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Apple className="w-8 h-8 text-foreground" />
                  <div>
                    <p className="font-medium">أجهزة iPhone / iPad</p>
                    <p className="text-sm text-muted-foreground">اتبع الخطوات التالية</p>
                  </div>
                </div>

                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">1</span>
                    <span>اضغط على زر المشاركة <span className="inline-block w-5 h-5 align-middle">⬆️</span> في أسفل الشاشة</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">2</span>
                    <span>مرر للأسفل واختر "إضافة إلى الشاشة الرئيسية"</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">3</span>
                    <span>اضغط "إضافة" في أعلى الشاشة</span>
                  </li>
                </ol>
              </div>
            ) : deferredPrompt ? (
              <Button onClick={handleInstall} className="w-full" size="lg">
                <Download className="w-5 h-5 ml-2" />
                تثبيت التطبيق
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                  <Chrome className="w-8 h-8 text-foreground" />
                  <div>
                    <p className="font-medium">متصفح Chrome / Edge</p>
                    <p className="text-sm text-muted-foreground">اتبع الخطوات التالية</p>
                  </div>
                </div>

                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">1</span>
                    <span>اضغط على قائمة المتصفح (⋮) في الأعلى</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">2</span>
                    <span>اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">3</span>
                    <span>اضغط "تثبيت" للتأكيد</span>
                  </li>
                </ol>
              </div>
            )}

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                مميزات التطبيق
              </h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ وصول سريع من الشاشة الرئيسية</li>
                <li>✓ يعمل بدون إنترنت (للصفحات المحملة)</li>
                <li>✓ إشعارات فورية</li>
                <li>✓ تجربة شبيهة بالتطبيقات الأصلية</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
