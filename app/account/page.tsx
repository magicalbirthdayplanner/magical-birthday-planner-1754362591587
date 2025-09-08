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
  Check,
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
  Trash2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
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
    planType: 'STARTER' | 'PLUS' | 'PRO';
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
    name: "🆓 Free",
    icon: User,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    features: ["Party creation wizard", "Basic theme selection", "Guest count planning"],
    price: "$0"
  },
  STARTER: {
    name: "🎈 Starter",
    icon: Star,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    features: ["Theme suggestions based on age", "Smart checklist & timeline", "Simple invitation creator"],
    price: "$9.99 per party"
  },
  PLUS: {
    name: "🧁 Plus", 
    icon: Zap,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    features: ["Everything in Starter", "Personalized activity ideas", "RSVP tracking", "Task reminders", "Basic budget tracker"],
    price: "$19.99 per party"
  },
  PRO: {
    name: "✨ Pro",
    icon: Crown,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    features: ["Everything in Plus", "Vendor recommendations", "Personalized food suggestions", "Smart budget tracker with insights"],
    price: "$29.99 per party"
  }
};

export default function AccountPage() {
  const { user, loading } = useAuth();
  const { currentPlan, subscriptionStatus, canUpgradeTo } = useSubscription();
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showUsageDetails, setShowUsageDetails] = useState(false);
  
  const handlePlanChange = (newPlan: 'STARTER' | 'PLUS' | 'PRO') => {
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
      // Fetch actual user profile from API with timeout
      const fetchProfile = async () => {
        try {
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
          
          const response = await fetch('/api/user/profile', {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const profileData = await response.json();
            
            // Check if user is superadmin
            const isSupeadmin = user.email === "arunexprasad@gmail.com";
            
            const profile: UserProfile = {
              id: profileData.id,
              email: profileData.email,
              name: profileData.name,
              displayName: profileData.displayName,
              createdAt: profileData.createdAt,
              isSupeadmin,
              subscription: {
                planType: "STARTER",
                status: "ACTIVE",
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                cancelAtPeriodEnd: false
              },
              usageStats: profileData.usageStats || {
                partiesThisMonth: 0,
                totalParties: 0,
                guestsThisMonth: 0,
                aiRequestsThisMonth: 0
              }
            };

            setUserProfile(profile);
            setFormData({
              name: profile.name,
              displayName: profile.displayName || ""
            });
            setNotifications({
              email: profileData.emailNotifications ?? true,
              reminders: profileData.partyReminders ?? true,
              marketing: profileData.marketingEmails ?? false
            });
          } else {
            console.error('Failed to fetch profile:', response.status, response.statusText);
            // Create fallback profile from auth user data
            const fallbackProfile: UserProfile = {
              id: user.id,
              email: user.email || '',
              name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              displayName: user.user_metadata?.display_name || '',
              createdAt: new Date().toISOString(),
              isSupeadmin: user.email === "arunexprasad@gmail.com",
              subscription: {
                planType: "STARTER",
                status: "ACTIVE",
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                cancelAtPeriodEnd: false
              },
              usageStats: {
                partiesThisMonth: 0,
                totalParties: 0,
                guestsThisMonth: 0,
                aiRequestsThisMonth: 0
              }
            };
            setUserProfile(fallbackProfile);
            setFormData({
              name: fallbackProfile.name,
              displayName: fallbackProfile.displayName || ""
            });
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Create fallback profile from auth user data
          const fallbackProfile: UserProfile = {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            displayName: user.user_metadata?.display_name || '',
            createdAt: new Date().toISOString(),
            isSupeadmin: user.email === "arunexprasad@gmail.com",
            subscription: {
              planType: "STARTER",
              status: "ACTIVE",
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              cancelAtPeriodEnd: false
            },
            usageStats: {
              partiesThisMonth: 0,
              totalParties: 0,
              guestsThisMonth: 0,
              aiRequestsThisMonth: 0
            }
          };
          setUserProfile(fallbackProfile);
          setFormData({
            name: fallbackProfile.name,
            displayName: fallbackProfile.displayName || ""
          });
        }
      };

      fetchProfile();
    }
  }, [user, loading, router]);

  const handleSaveProfile = async () => {
    // Clear previous states
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Name is required');
      }

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          displayName: formData.displayName.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const updatedProfile = await response.json();
      
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          name: updatedProfile.name,
          displayName: updatedProfile.displayName
        });
      }

      // Dispatch event to notify header component of profile update
      window.dispatchEvent(new CustomEvent('profileUpdated', { 
        detail: { 
          name: updatedProfile.name,
          displayName: updatedProfile.displayName
        } 
      }));

      setSaveSuccess(true);
      setIsEditing(false);
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (userProfile) {
      setFormData({
        name: userProfile.name,
        displayName: userProfile.displayName || ""
      });
    }
    setSaveError(null);
    setSaveSuccess(false);
    setIsEditing(false);
  };

  const handleSaveNotifications = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailNotifications: notifications.email,
          partyReminders: notifications.reminders,
          marketingEmails: notifications.marketing
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }

      // Show success message (you could add a toast notification here)
      console.log('Notification preferences updated successfully');
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // You could add a toast notification here
    }
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

  const currentPlanDetails = planDetails[currentPlan];
  const PlanIcon = currentPlanDetails.icon;

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
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="subscription" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Subscription
            </TabsTrigger>
            <TabsTrigger value="account-security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Account Security
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
                    <Button variant="outline" onClick={() => {
                      setIsEditing(true);
                      setSaveError(null);
                      setSaveSuccess(false);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Success/Error Messages */}
                {saveSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="text-sm text-green-700 dark:text-green-300">
                      Profile updated successfully!
                    </span>
                  </div>
                )}
                
                {saveError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <span className="text-sm text-red-700 dark:text-red-300">
                      {saveError}
                    </span>
                  </div>
                )}
                
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
                      <div className={`p-2 rounded-full ${currentPlanDetails.bgColor}`}>
                        <PlanIcon className={`h-5 w-5 ${currentPlanDetails.color}`} />
                      </div>
                      Current Plan: {currentPlanDetails.name}
                    </CardTitle>
                    <CardDescription>
                      Your current subscription details and usage
                    </CardDescription>
                  </div>
                  <Badge className={subscriptionStatus.isActive ? currentPlanDetails.bgColor : 'bg-gray-100 dark:bg-gray-800'}>
                    {subscriptionStatus.isActive ? 'ACTIVE' : 'FREE'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Plan Features</h4>
                  <ul className="space-y-1">
                    {currentPlanDetails.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                        <Check className="h-3 w-3 text-green-500 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Plan Upgrade Options */}
            {subscriptionStatus.canUpgrade && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    {currentPlan === 'FREE' ? 'Choose Your Plan' : 'Upgrade Your Plan'}
                  </CardTitle>
                  <CardDescription>
                    {currentPlan === 'FREE' 
                      ? 'Select a plan to unlock party management features'
                      : 'Unlock more features with our advanced plans'
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(['STARTER', 'PLUS', 'PRO'] as const).map((planKey) => {
                      if (!canUpgradeTo(planKey)) return null;
                      
                      const plan = planDetails[planKey];
                      const PlanIcon = plan.icon;
                      
                      return (
                        <div key={planKey} className={`border rounded-lg p-4 bg-gradient-to-br ${
                          planKey === 'PLUS' ? 'border-2 border-blue-200 from-blue-50 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/30 relative' :
                          planKey === 'STARTER' ? 'from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30' :
                          'from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/30'
                        }`}>
                          {planKey === 'PLUS' && (
                            <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs">
                              Most Popular
                            </Badge>
                          )}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <PlanIcon className={`h-5 w-5 ${plan.color}`} />
                              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{plan.name}</h3>
                            </div>
                            <Badge variant="outline" className="text-xs">{plan.price}</Badge>
                          </div>
                          <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                            {plan.features.map((feature, index) => (
                              <li key={index}>• {feature}</li>
                            ))}
                          </ul>
                          <Button 
                            className={`w-full text-xs ${
                              planKey === 'STARTER' ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600' :
                              planKey === 'PLUS' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600' :
                              'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600'
                            }`}
                            asChild
                          >
                            <Link href={`/pricing?upgrade=${planKey.toLowerCase()}`}>
                              {currentPlan === 'FREE' ? 'Choose' : 'Upgrade to'} {planKey === 'STARTER' ? 'Starter' : planKey === 'PLUS' ? 'Plus' : 'Pro'}
                            </Link>
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Support Information */}
                  <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <HeadphonesIcon className="h-4 w-4 text-blue-600" />
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Need Help Choosing?</h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Contact our support team for personalized recommendations based on your party planning needs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plan Management */}
            {userProfile.subscription && (
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
                      One-time Payment
                    </Badge>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowUsageDetails(!showUsageDetails)}
                    >
                      {showUsageDetails ? 'Hide' : 'View'} Usage Details
                    </Button>
                  </div>
                  
                  {showUsageDetails && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Usage Details for This Month
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Parties Created</span>
                            <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {userProfile.usageStats?.partiesThisMonth || 0}
                            </span>
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Guests</span>
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {userProfile.usageStats?.guestsThisMonth || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <Separator className="my-4" />
                      
                      <h5 className="font-medium text-gray-900 dark:text-gray-100 mb-3">All-Time Statistics</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="text-center">
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                              {userProfile.usageStats?.totalParties || 0}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">Total Parties</div>
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="text-center">
                            <div className="text-xl font-bold text-pink-600 dark:text-pink-400">
                              {currentPlan.name}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">Current Plan</div>
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="text-center">
                            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                              {new Date(userProfile.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-300">Member Since</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>


          {/* Account Security Tab */}
          <TabsContent value="account-security" className="space-y-6">
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
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      Password
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Keep your account secure with a strong password
                    </p>
                  </div>
                  <Button variant="outline">
                    Change Password
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium text-red-600 dark:text-red-400 flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete Account
                    </Label>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Permanently delete your account and all associated data
                    </p>
                  </div>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
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