"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, User, Mail, Shield, Sparkles } from "lucide-react";
import Link from "next/link";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export default function AuthModal({ 
  isOpen, 
  onClose, 
  title = "Save Your Party Plan", 
  description = "Sign in to save your party plan, access AI-powered recommendations, and keep your celebrations safe and organized."
}: AuthModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md mx-auto">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-3 rounded-full">
              <PartyPopper className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-yellow-600 bg-clip-text text-transparent">
            {title}
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-300 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6">
          {/* Benefits List */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 space-y-3">
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <Shield className="h-4 w-4 text-purple-600 mr-3 flex-shrink-0" />
              <span>Keep your party plans safe and secure</span>
            </div>
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <Sparkles className="h-4 w-4 text-pink-600 mr-3 flex-shrink-0" />
              <span>Access AI-powered personalized recommendations</span>
            </div>
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <User className="h-4 w-4 text-yellow-600 mr-3 flex-shrink-0" />
              <span>Manage multiple parties from your dashboard</span>
            </div>
            <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
              <Mail className="h-4 w-4 text-blue-600 mr-3 flex-shrink-0" />
              <span>Send invitations and track RSVPs</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <Link href="/signup" className="w-full">
              <Button 
                size="lg" 
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                onClick={onClose}
              >
                Create Free Account
              </Button>
            </Link>
            
            <Link href="/signin" className="w-full">
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-400 dark:text-purple-400 dark:hover:bg-purple-900/20"
                onClick={onClose}
              >
                Sign In
              </Button>
            </Link>
          </div>

          {/* Continue Demo Option */}
          <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              Continue exploring demo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}