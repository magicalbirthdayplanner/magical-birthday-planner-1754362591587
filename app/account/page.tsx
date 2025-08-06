"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  Mail, 
  Settings, 
  CreditCard, 
  Bell, 
  Shield, 
  Calendar,
  Crown,
  Star,
  Zap,
  Sparkles,
  FileText,
  Download,
  Edit,
  Save,
  X,
  Check
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  avatar?: string;
  createdAt: string;
  isSupeadmin?: boolean;
  subscription?: {
    planType: 'FREE' | 'STARTER' | 'PROFESSIONAL';
    status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE';
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
  };
  usageStats?: {
    partiesThisMonth: number;
    totalParties: number;
    guestsThisMonth: number;
    aiRequestsThisMonth: number;
  };
}

const planDetails = {
  FREE: {
    name: "Essential Party",
    icon: Star,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    features: ["1 party/month", "Max 10 guests", "Basic themes"]
  },
  STARTER: {
    name: "Magical Party",
    icon: Zap,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    features: ["1 birthday/year", "Unlimited guests", "AI recommendations"]
  },
  PROFESSIONAL: {
    name: "Ultimate Party",
    icon: Crown,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    features: ["Up to 3 birthdays/year", "Unlimited guests", "Premium features"]
  }
};

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    displayName: ""
  });
  const [notifications, setNotifications] = useState({
    email: true,
    reminders: true,
    marketing: false
  });
  
  const handlePlanChange = (newPlan: 'FREE' | 'STARTER' | 'PROFESSIONAL') => {
    if (userProfile?.isSupeadmin && userProfile.subscription) {
      setUserProfile({
        ...userProfile,
        subscription: {
          ...userProfile.subscription,
          planType: newPlan
        }
      });
      
      // Store plan in localStorage for header component
      localStorage.setItem('superadmin_plan', newPlan);
      
      // Dispatch event to notify header component
      window.dispatchEvent(new CustomEvent('planChanged', { 
        detail: { plan: newPlan } 
      }));
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/signin");
      return;
    }

    if (user) {
      // Check if user is superadmin
      const isSupeadmin = user.email === "arunexprasad@gmail.com";
      
      // Mock user profile data - in real app, fetch from API
      const mockProfile: UserProfile = {
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || user.email?.split("@")[0] || "",
        displayName: user.user_metadata?.display_name,
        createdAt: user.created_at || new Date().toISOString(),
        isSupeadmin,
        subscription: {
          planType: "FREE",
          status: "ACTIVE",
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          cancelAtPeriodEnd: false
        },
        usageStats: {
          partiesThisMonth: 1,
          totalParties: 3,
          guestsThisMonth: 8,
          aiRequestsThisMonth: 5
        }
      };

      setUserProfile(mockProfile);
      setFormData({
        name: mockProfile.name,
        displayName: mockProfile.displayName || ""
      });
    }
  }, [user, loading, router]);

  const handleSaveProfile = () => {
    // In real app, update profile via API
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        name: formData.name,
        displayName: formData.displayName
      });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (userProfile) {
      setFormData({
        name: userProfile.name,
        displayName: userProfile.displayName || ""
      });
    }
    setIsEditing(false);
  };

  if (loading || !userProfile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading your account...</p>
        </div>
      </div>
    );
  }

  const currentPlan = planDetails[userProfile.subscription?.planType || 'FREE'];
  const PlanIcon = currentPlan.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Account Settings</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Manage your profile, subscription, and preferences</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Update your personal details and account information
                    </CardDescription>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" onClick={() => setIsEditing(true)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile}>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userProfile.email}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div>
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      disabled={!isEditing}
                      placeholder="Optional display name"
                    />
                  </div>
                  <div>
                    <Label>Member Since</Label>
                    <Input
                      value={new Date(userProfile.createdAt).toLocaleDateString()}
                      disabled
                      className="bg-gray-50 dark:bg-gray-800"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Usage Statistics
                </CardTitle>
                <CardDescription>
                  Your party planning activity this month
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {userProfile.usageStats?.partiesThisMonth || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Parties This Month</div>
                  </div>
                  <div className="text-center p-4 bg-pink-50 dark:bg-pink-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                      {userProfile.usageStats?.totalParties || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Parties</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {userProfile.usageStats?.guestsThisMonth || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Guests This Month</div>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {userProfile.usageStats?.aiRequestsThisMonth || 0}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">AI Requests</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            {/* Current Plan Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`p-2 rounded-full ${currentPlan.bgColor}`}>
                        <PlanIcon className={`h-5 w-5 ${currentPlan.color}`} />
                      </div>
                      Current Plan: {currentPlan.name}
                    </CardTitle>
                    <CardDescription>
                      Your current subscription details and usage
                    </CardDescription>
                  </div>
                  <Badge className={currentPlan.bgColor}>
                    {userProfile.subscription?.status || 'ACTIVE'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Plan Features</h4>
                    <ul className="space-y-1">
                      {currentPlan.features.map((feature, index) => (
                        <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                          <Check className="h-3 w-3 text-green-500 mr-2" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Usage This Month</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Parties Created</span>
                        <span className="font-medium">{userProfile.usageStats?.partiesThisMonth || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">Total Guests</span>
                        <span className="font-medium">{userProfile.usageStats?.guestsThisMonth || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">AI Requests</span>
                        <span className="font-medium">{userProfile.usageStats?.aiRequestsThisMonth || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Options */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  Upgrade Your Plan
                </CardTitle>
                <CardDescription>
                  Unlock more features with our premium plans
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Essential Plan */}
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Essential Party</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">$9.99</Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      Perfect for simple celebrations with basic features
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                      <li>• 1 event creation</li>
                      <li>• Max 10 guests</li>
                      <li>• Basic themes</li>
                      <li>• Community support</li>
                    </ul>
                    <Button 
                      className="w-full text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      asChild
                    >
                      <a 
                        href="https://checkout.dodopayments.com/buy/pdt_Jw4ObhU8ojSaq87wELhsm?quantity=1" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Upgrade to Essential
                      </a>
                    </Button>
                  </div>

                  {/* Magical Plan */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 relative">
                    <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs">
                      Most Popular
                    </Badge>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Magical Party</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">$19.99</Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      Perfect for birthday celebrations with AI features
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                      <li>• 1 birthday/year</li>
                      <li>• Unlimited guests</li>
                      <li>• AI recommendations</li>
                      <li>• Premium themes</li>
                    </ul>
                    <Button 
                      className="w-full text-xs bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600"
                      asChild
                    >
                      <a 
                        href="https://checkout.dodopayments.com/buy/pdt_rSGRT2hBbKsoln84yQgHC?quantity=1" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Upgrade to Magical
                      </a>
                    </Button>
                  </div>

                  {/* Ultimate Plan */}
                  <div className="border rounded-lg p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-amber-600" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Ultimate Party</h3>
                      </div>
                      <Badge variant="outline" className="text-xs">$39.99</Badge>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                      Premium package for multiple celebrations
                    </p>
                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                      <li>• Up to 3 birthdays/year</li>
                      <li>• Unlimited guests</li>
                      <li>• Premium features</li>
                      <li>• Priority support</li>
                    </ul>
                    <Button 
                      className="w-full text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      asChild
                    >
                      <a 
                        href="https://checkout.dodopayments.com/buy/pdt_v3NFp5Zq587xbPoPLd29x?quantity=1" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Upgrade to Ultimate
                      </a>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Sparkles className="h-4 w-4 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Need help choosing?
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Contact our support team for personalized recommendations based on your party planning needs.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Management */}
            {userProfile.subscription && userProfile.subscription.planType !== 'FREE' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Manage Your Subscription
                  </CardTitle>
                  <CardDescription>
                    Update your subscription settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Current Period
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Valid until {new Date(userProfile.subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {userProfile.subscription.cancelAtPeriodEnd ? 'Ends at period' : 'Auto-renew'}
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      View Usage Details
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Receipt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>
                  Choose how you want to be notified about your parties and account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-notifications" className="text-base font-medium">
                      Email Notifications
                    </Label>
                    <p className="text-sm text-gray-600">
                      Receive party reminders and updates via email
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notifications.email}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, email: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="party-reminders" className="text-base font-medium">
                      Party Reminders
                    </Label>
                    <p className="text-sm text-gray-600">
                      Get reminders for upcoming party tasks and deadlines
                    </p>
                  </div>
                  <Switch
                    id="party-reminders"
                    checked={notifications.reminders}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, reminders: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="marketing-emails" className="text-base font-medium">
                      Marketing Emails
                    </Label>
                    <p className="text-sm text-gray-600">
                      Receive tips, inspiration, and special offers
                    </p>
                  </div>
                  <Switch
                    id="marketing-emails"
                    checked={notifications.marketing}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, marketing: checked })
                    }
                  />
                </div>

                <div className="pt-4">
                  <Button>Save Notification Preferences</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Billing History
                </CardTitle>
                <CardDescription>
                  View and download your invoices and receipts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No billing history available</p>
                  <p className="text-sm text-gray-500">
                    Your invoices and receipts will appear here once you upgrade to a paid plan
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Account Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Security
                </CardTitle>
                <CardDescription>
                  Manage your password and security settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Password</Label>
                    <p className="text-sm text-gray-600">
                      Last updated {new Date().toLocaleDateString()}
                    </p>
                  </div>
                  <Button variant="outline">Change Password</Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Account Deletion</Label>
                    <p className="text-sm text-gray-600">
                      Permanently delete your account and all data
                    </p>
                  </div>
                  <Button variant="destructive" size="sm">
                    Delete Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}