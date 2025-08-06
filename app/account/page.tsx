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
  X
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${currentPlan.bgColor}`}>
                      <PlanIcon className={`h-6 w-6 ${currentPlan.color}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{currentPlan.name}</h3>
                      <div className="flex gap-2 mt-2">
                        {currentPlan.features.map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      className={userProfile.subscription?.status === 'ACTIVE' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'}
                    >
                      {userProfile.subscription?.status || 'ACTIVE'}
                    </Badge>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                      {userProfile.subscription?.cancelAtPeriodEnd 
                        ? 'Cancels on' 
                        : 'Renews on'
                      } {new Date(userProfile.subscription?.currentPeriodEnd || '').toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {userProfile.isSupeadmin ? (
                  <div className="mt-6">
                    <div className="mb-4">
                      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">SUPERADMIN</Badge>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Testing access - switch between any plan</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(planDetails).map(([key, plan]) => {
                        const PlanIcon = plan.icon;
                        const isActive = userProfile.subscription?.planType === key;
                        return (
                          <Button
                            key={key}
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePlanChange(key as any)}
                            className={`flex flex-col h-auto p-3 ${isActive ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                          >
                            <PlanIcon className={`h-4 w-4 mb-1 ${plan.color}`} />
                            <span className="text-xs font-medium">{plan.name}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4 mt-6">
                    <Button asChild>
                      <Link href="/pricing">Upgrade Plan</Link>
                    </Button>
                    {userProfile.subscription?.planType !== 'FREE' && (
                      <Button variant="outline">
                        Manage Subscription
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Methods
                </CardTitle>
                <CardDescription>
                  Manage your payment methods and billing information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">No payment methods added yet</p>
                  <Button>Add Payment Method</Button>
                </div>
              </CardContent>
            </Card>
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