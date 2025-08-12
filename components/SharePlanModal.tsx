"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Share2, 
  Copy, 
  Facebook, 
  Twitter, 
  Mail, 
  MessageCircle,
  Link,
  Check
} from "lucide-react";

interface Party {
  id: string;
  childName: string;
  theme: string;
  date: string;
  age: number;
}

interface SharePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  party: Party;
}

export default function SharePlanModal({ isOpen, onClose, party }: SharePlanModalProps) {
  const [shareUrl, setShareUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUrlGenerated, setIsUrlGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateShareUrl = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/party/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ partyId: party.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate share URL');
      }

      const data = await response.json();
      const baseUrl = window.location.origin;
      const fullShareUrl = `${baseUrl}/share/${data.shareToken}`;
      
      setShareUrl(fullShareUrl);
      setIsUrlGenerated(true);
      
      toast({
        title: "Share link generated!",
        description: "Your party plan is now shareable with this link.",
      });
    } catch (error) {
      console.error('Error generating share URL:', error);
      toast({
        title: "Error",
        description: "Failed to generate share link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied!",
        description: "Share link copied to clipboard.",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Error",
        description: "Failed to copy link. Please try selecting and copying manually.",
        variant: "destructive",
      });
    }
  };

  const shareToSocial = (platform: string) => {
    const title = `Join ${party.childName}'s ${party.theme} Birthday Party!`;
    const text = `You're invited to ${party.childName}'s ${party.theme} themed birthday party! Check out all the details:`;
    
    let url = "";
    
    switch (platform) {
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(text)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "whatsapp":
        url = `https://wa.me/?text=${encodeURIComponent(text + " " + shareUrl)}`;
        break;
      case "email":
        url = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + "\n\n" + shareUrl)}`;
        break;
    }
    
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  const handleClose = () => {
    setIsUrlGenerated(false);
    setShareUrl("");
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Party Plan
          </DialogTitle>
          <DialogDescription>
            Share {party.childName}'s {party.theme} birthday party details with family and friends.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {!isUrlGenerated ? (
            <div className="text-center space-y-4">
              <div className="p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
                <Link className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Generate a secure shareable link for your party plan
                </p>
              </div>
              
              <Button 
                onClick={generateShareUrl} 
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white"
              >
                {isGenerating ? "Generating..." : "Generate Share Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="share-url">Share Link</Label>
                <div className="flex mt-2">
                  <Input 
                    id="share-url"
                    value={shareUrl} 
                    readOnly 
                    className="rounded-r-none"
                  />
                  <Button 
                    onClick={copyToClipboard}
                    variant="outline"
                    className="rounded-l-none border-l-0"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium">Share on social media</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => shareToSocial("facebook")}
                    className="w-full"
                  >
                    <Facebook className="h-4 w-4 mr-2" />
                    Facebook
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => shareToSocial("twitter")}
                    className="w-full"
                  >
                    <Twitter className="h-4 w-4 mr-2" />
                    Twitter
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => shareToSocial("whatsapp")}
                    className="w-full"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => shareToSocial("email")}
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}