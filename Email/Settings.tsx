import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsIcon, Eye, Mail, Upload, Image, RefreshCw, Trash2, Save, Loader2, Plus, CheckCircle, AlertCircle, X, Beaker } from 'lucide-react';
import { BannerUpload } from '../banners/BannerUpload';
import { MonthlyPaymentTemplate } from '../documents/templates/MonthlyPaymentTemplate';
import { FullSettlementTemplate } from '../documents/templates/FullSettlementTemplate';
import { useBanner } from '../../hooks/useBanner';
import messageSettingsService, { MessageSetting } from '../../services/messageSettingsService';

interface ExtendedMessageSetting extends MessageSetting {
  is_mission?: boolean;
}

interface EmailSettingsMission {
  id: string;
  user_id: string | null;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string | null;
  email_template: string;
  email_subject_template: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

import { emailService } from '../../services/emailService';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, TABLES } from '../../lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE || '';

interface EmailConfig {
  provider: 'brevo';
  email: string;
  brevoApiKey: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuth();
  // Tab state
  const [activeTab, setActiveTab] = useState<'banners' | 'preview' | 'email' | 'emailSettings'>('banners');
  const [previewType, setPreviewType] = useState<'monthly_payment' | 'full_settlement'>('monthly_payment');
  const [selectedCompany, setSelectedCompany] = useState<string>('AEON');
  
  // Email settings state
  const [messageSettings, setMessageSettings] = useState<ExtendedMessageSetting[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [emailForm, setEmailForm] = useState({
    template_name: '',
    subject: '',
    cc_emails: [''],
    message_content: '',
    email_to: ''
  });
  const [loadingMessageSettings, setLoadingMessageSettings] = useState(false);
  const [savingMessageSettings, setSavingMessageSettings] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [isCreatingNewTemplate, setIsCreatingNewTemplate] = useState(false);
  const [messageSettingsStatus, setMessageSettingsStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
  }>({ type: 'idle', message: '' });

  // Email configuration state (from EmailSettings)
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    provider: 'brevo',
    email: '',
    brevoApiKey: ''
  });
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testMessage, setTestMessage] = useState('This is a test email to verify the email configuration is working properly.');

  // Email settings list state
  const [emailSettingsList, setEmailSettingsList] = useState<any[]>([]);
  const [loadingEmailSettings, setLoadingEmailSettings] = useState(false);
  const [selectedEmailSetting, setSelectedEmailSetting] = useState<string>('');
  
  // Email limits state
  const [emailLimits, setEmailLimits] = useState<{
    [configId: string]: {
      dailyLimit: number;
      monthlyLimit: number;
      dailyUsage: number;
      monthlyUsage: number;
      dailyRemaining: number;
      monthlyRemaining: number;
      brevoMonthlyRemaining?: number;
      brevoPlanName?: string;
    }
  }>({});
  const [loadingLimits, setLoadingLimits] = useState(false);
  
  // New email account form state
  const [showNewAccountForm, setShowNewAccountForm] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    email: '',
    brevoApiKey: '',
    provider: 'brevo' as const
  });
  const [savingNewAccount, setSavingNewAccount] = useState(false);
  const [newAccountStatus, setNewAccountStatus] = useState<{
    type: 'success' | 'error' | 'idle';
    message: string;
  }>({ type: 'idle', message: '' });
  
  // Load message settings when component mounts or when email tab is selected
  useEffect(() => {
    if (activeTab === 'email') {
      loadMessageSettings();
    }
  }, [activeTab]);

  // Load email configuration when emailSettings tab is selected
  useEffect(() => {
    if (activeTab === 'emailSettings') {
      loadEmailConfig();
      loadAllEmailSettings();
    }
  }, [activeTab, user]);

  // Load email configuration
  const loadEmailConfig = async () => {
    if (user?.id) {
      try {
        console.log('Loading email config for user:', user.id);
        
        // Try to load from email_settings_mission first (aligning with schemas.md)
        const { data: missionConfig, error: missionError } = await supabase
          .from('email_settings_mission')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
          
        if (!missionError && missionConfig) {
          console.log('Retrieved mission email config:', missionConfig);
          const config: EmailConfig = {
            provider: 'brevo', // Defaulting to brevo as per interface
            email: missionConfig.from_email,
            brevoApiKey: missionConfig.smtp_password // Assuming smtp_password stores the API key if provider is brevo
          };
          setEmailConfig(config);
          setTestEmail(config.email);
          return;
        }

        // Fallback to existing emailService
        const savedConfig = await emailService.getEmailConfig(user.id);
        console.log('Retrieved legacy email config:', savedConfig);
        if (savedConfig) {
          setEmailConfig(savedConfig);
          setTestEmail(savedConfig.email);
        }
      } catch (error) {
        console.error('Error loading active email config:', error);
      }
    }
  };

  // Load email limits for all configurations
  const loadEmailLimits = async (settings: any[]) => {
    setLoadingLimits(true);
    try {
      const limitsData: { [configId: string]: any } = {};
      
      // Load limits for each configuration
      for (const setting of settings) {
        try {
          const limits = await emailService.getEmailLimitsAndUsage(setting.id);
          limitsData[setting.id] = limits;
        } catch (error) {
          console.error(`Error loading limits for config ${setting.id}:`, error);
          limitsData[setting.id] = {
            dailyLimit: 0,
            monthlyLimit: 0,
            dailyUsage: 0,
            monthlyUsage: 0,
            dailyRemaining: 0,
            monthlyRemaining: 0
          };
        }
      }
      
      setEmailLimits(limitsData);
    } catch (error) {
      console.error('Error loading email limits:', error);
    } finally {
      setLoadingLimits(false);
    }
  };

  // Load all email settings
  const loadAllEmailSettings = async () => {
    setLoadingEmailSettings(true);
    try {
      console.log('Loading all email settings...');
      
      // Fetch from both legacy and mission tables
      const [legacySettings, { data: missionSettings, error: missionError }] = await Promise.all([
        emailService.getAllEmailSettings(),
        supabase.from('email_settings_mission').select('*')
      ]);

      let combinedSettings = [...legacySettings];
      
      if (!missionError && missionSettings) {
        const mappedMission = (missionSettings as EmailSettingsMission[]).map((ms: EmailSettingsMission) => ({
          ...ms,
          email: ms.from_email,
          provider: 'mission-smtp',
          is_mission: true
        }));
        combinedSettings = [...combinedSettings, ...mappedMission];
      }

      console.log('Retrieved combined email settings:', combinedSettings);
      setEmailSettingsList(combinedSettings);
      
      // Find and set the active setting
      const activeSetting = combinedSettings.find(setting => setting.is_active);
      if (activeSetting) {
        setSelectedEmailSetting(activeSetting.id);
      }

      // Load email limits for all configurations
      if (combinedSettings.length > 0) {
        await loadEmailLimits(combinedSettings);
      }
    } catch (error) {
      console.error('Error loading email settings:', error);
    } finally {
      setLoadingEmailSettings(false);
    }
  };

  // Load selected template data when template changes
  useEffect(() => {
      if (selectedTemplate && messageSettings.length > 0 && !isCreatingNewTemplate) {
        const template = messageSettings.find((ms: ExtendedMessageSetting) => ms.id === selectedTemplate);
        if (template) {
        setEmailForm({
          template_name: template.template_name,
          subject: template.subject,
          cc_emails: template.cc_emails && template.cc_emails.length > 0 ? template.cc_emails : [''],
          message_content: template.message_content,
          email_to: (template as any).email_to || ''
        });
      }
    } else if (isCreatingNewTemplate) {
      setEmailForm({
        template_name: '',
        subject: '',
        cc_emails: [''],
        message_content: '',
        email_to: ''
      });
    }
  }, [selectedTemplate, messageSettings, isCreatingNewTemplate]);
  
  // Use the banner hooks to fetch both top and bottom banners from database
  const { 
    banner: topBanner, 
    loading: topBannerLoading, 
    error: topBannerError, 
    refreshBanner: refreshTopBanner 
  } = useBanner('top', selectedCompany);
  
  const { 
    banner: bottomBanner, 
    loading: bottomBannerLoading, 
    error: bottomBannerError, 
    refreshBanner: refreshBottomBanner 
  } = useBanner('bottom', selectedCompany);
  
  // Handle successful banner upload
  const handleTopBannerUploaded = (bannerUrl: string) => {
    console.log('Top banner uploaded successfully:', bannerUrl);
    // Add a small delay to ensure database transaction is committed
    setTimeout(() => {
      refreshTopBanner();
    }, 500);
  };
  
  const handleBottomBannerUploaded = (bannerUrl: string) => {
    console.log('Bottom banner uploaded successfully:', bannerUrl);
    // Add a small delay to ensure database transaction is committed
    setTimeout(() => {
      refreshBottomBanner();
    }, 500);
  };

  // Handle banner reset
  const handleResetTopBanner = async () => {
    try {
      // Get the public_id from database
      const { data, error: fetchError } = await supabase
        .from('company_banners')
        .select('public_id')
        .eq('company_name', selectedCompany)
        .eq('banner_type', 'top')
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch banner: ${fetchError.message}`);
      }
      
      if (data?.public_id) {
        // Delete from Supabase Storage
        const { error: storageError } = await supabase.storage
          .from(import.meta.env.VITE_STORAGE_BUCKET_BANNERS || 'banners')
          .remove([data.public_id]);
          
        if (storageError) {
          console.error('Error deleting banner from storage:', storageError);
        }
      }
      
      // Remove banner from database
      const { error: dbError } = await supabase
        .from('company_banners')
        .delete()
        .eq('company_name', selectedCompany)
        .eq('banner_type', 'top');

      if (dbError) {
        throw new Error(`Failed to remove banner from database: ${dbError.message}`);
      }

      refreshTopBanner();
    } catch (error) {
      console.error('Banner reset error:', error);
    }
  };

  const handleResetBottomBanner = async () => {
    try {
      // Get the public_id from database
      const { data, error: fetchError } = await supabase
        .from('company_banners')
        .select('public_id')
        .eq('company_name', selectedCompany)
        .eq('banner_type', 'bottom')
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw new Error(`Failed to fetch banner: ${fetchError.message}`);
      }
      
      if (data?.public_id) {
        // Delete from Supabase Storage
        const { error: storageError } = await supabase.storage
          .from(import.meta.env.VITE_STORAGE_BUCKET_BANNERS || 'banners')
          .remove([data.public_id]);
          
        if (storageError) {
          console.error('Error deleting banner from storage:', storageError);
        }
      }
      
      // Remove banner from database
      const { error: dbError } = await supabase
        .from('company_banners')
        .delete()
        .eq('company_name', selectedCompany)
        .eq('banner_type', 'bottom');

      if (dbError) {
        throw new Error(`Failed to remove banner from database: ${dbError.message}`);
      }

      refreshBottomBanner();
    } catch (error) {
      console.error('Banner reset error:', error);
    }
  };
  
  // Handle message settings
  const loadMessageSettings = async () => {
    setLoadingMessageSettings(true);
    try {
      // Load from message_settings table
      const settings = await messageSettingsService.getAllMessageSettings();
      
      // Also load from email_settings_mission (aligning with schemas.md)
      const { data: missionSettings, error: missionError } = await supabase
        .from('email_settings_mission')
        .select('*');

      const combinedSettings: ExtendedMessageSetting[] = [...settings];

      if (!missionError && missionSettings) {
        const mappedMission: ExtendedMessageSetting[] = (missionSettings as EmailSettingsMission[]).map((ms: EmailSettingsMission) => ({
          id: ms.id,
          template_name: ms.from_name || 'Mission Default',
          subject: ms.email_subject_template || '',
          cc_emails: [],
          message_content: ms.email_template || '',
          email_to: '',
          is_active: ms.is_active,
          created_at: ms.created_at,
          updated_at: ms.updated_at,
          is_mission: true
        }));
        
        // Merge without duplicates on template_name
        mappedMission.forEach((ms: ExtendedMessageSetting) => {
          if (!combinedSettings.some(s => s.template_name === ms.template_name)) {
            combinedSettings.push(ms);
          }
        });
      }

      setMessageSettings(combinedSettings);
      
      // Set default template if none selected
      if (!selectedTemplate && combinedSettings.length > 0) {
        setSelectedTemplate(combinedSettings[0].id);
      }
    } catch (error) {
      console.error('Error loading message settings:', error);
      setMessageSettingsStatus({
        type: 'error',
        message: 'Failed to load message settings'
      });
    } finally {
      setLoadingMessageSettings(false);
    }
  };

  // Handle email form changes
  const handleEmailFormChange = (field: string, value: string | string[]) => {
    setEmailForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const detectedVariables = useMemo(() => {
    const content = emailForm.message_content || '';
    const matches = content.match(/\{[^}]+\}/g) || [];
    return Array.from(new Set(matches));
  }, [emailForm.message_content]);

  // Add new CC email field
  const addCCEmail = () => {
    setEmailForm(prev => ({
      ...prev,
      cc_emails: [...prev.cc_emails, '']
    }));
  };

  // Remove CC email field
  const removeCCEmail = (index: number) => {
    setEmailForm(prev => ({
      ...prev,
      cc_emails: prev.cc_emails.filter((_, i) => i !== index)
    }));
  };

  // Update CC email at specific index
  const updateCCEmail = (index: number, value: string) => {
    setEmailForm(prev => ({
      ...prev,
      cc_emails: prev.cc_emails.map((email, i) => i === index ? value : email)
    }));
  };

  // Start creating new template
  const startCreatingNewTemplate = () => {
    setIsCreatingNewTemplate(true);
    setSelectedTemplate('');
    setEmailForm({
      template_name: '',
      subject: '',
      cc_emails: [''],
      message_content: '',
      email_to: ''
    });
  };

  // Cancel creating new template
  const cancelCreatingNewTemplate = () => {
    setIsCreatingNewTemplate(false);
    if (messageSettings.length > 0) {
      setSelectedTemplate(messageSettings[0].id);
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    const template = messageSettings.find((ms: ExtendedMessageSetting) => ms.id === templateId);
    if (!template) return;

    if (!confirm(`Are you sure you want to delete the template "${template.template_name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingTemplate(true);
    try {
      if ((template as any).is_mission) {
        const { error } = await supabase
          .from('email_settings_mission')
          .delete()
          .eq('id', templateId);
        if (error) throw error;
      } else {
        await messageSettingsService.deleteMessageSetting(template.template_name);
      }
      
      setMessageSettingsStatus({
        type: 'success',
        message: 'Template deleted successfully!'
      });

      // Reload settings
      await loadMessageSettings();

      // If we deleted the currently selected template, select another one
      if (selectedTemplate === templateId) {
        const remainingTemplates = messageSettings.filter((ms: ExtendedMessageSetting) => ms.id !== templateId);
        if (remainingTemplates.length > 0) {
          setSelectedTemplate(remainingTemplates[0].id);
        } else {
          setSelectedTemplate('');
        }
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessageSettingsStatus({ type: 'idle', message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error deleting template:', error);
      setMessageSettingsStatus({
        type: 'error',
        message: 'Failed to delete template'
      });
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Save message settings
  const handleSaveMessageSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailForm.template_name.trim()) {
      setMessageSettingsStatus({
        type: 'error',
        message: 'Template name is required'
      });
      return;
    }

    setSavingMessageSettings(true);
    setMessageSettingsStatus({ type: 'idle', message: '' });

    try {
      // Filter out empty CC emails
      const filteredCCEmails = emailForm.cc_emails.filter(email => email.trim() !== '');
      
      const currentTemplate = messageSettings.find((ms: ExtendedMessageSetting) => ms.id === selectedTemplate);

      if (isCreatingNewTemplate) {
        // Check if template name already exists
        const existingTemplate = messageSettings.find((ms: ExtendedMessageSetting) => 
          ms.template_name.toLowerCase() === emailForm.template_name.toLowerCase()
        );
        
        if (existingTemplate) {
          setMessageSettingsStatus({
            type: 'error',
            message: 'A template with this name already exists'
          });
          return;
        }

        // Create new template - Defaulting to legacy message_settings for new templates
        // unless specifically requested to use mission table
        await messageSettingsService.createMessageSetting({
          template_name: emailForm.template_name,
          subject: emailForm.subject,
          cc_emails: filteredCCEmails,
          message_content: emailForm.message_content,
          email_to: emailForm.email_to,
          is_active: true
        });

        setMessageSettingsStatus({
          type: 'success',
          message: 'Template created successfully!'
        });

        setIsCreatingNewTemplate(false);
      } else if (currentTemplate) {
        // Update existing template
        if ((currentTemplate as any).is_mission) {
          const { error } = await supabase
            .from('email_settings_mission')
            .update({
              from_name: emailForm.template_name,
              email_subject_template: emailForm.subject,
              email_template: emailForm.message_content,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentTemplate.id);
          if (error) throw error;
        } else {
          await messageSettingsService.updateMessageSetting(currentTemplate.template_name, {
            subject: emailForm.subject,
            cc_emails: filteredCCEmails,
            message_content: emailForm.message_content,
            email_to: emailForm.email_to,
            is_active: true
          });
        }

        setMessageSettingsStatus({
          type: 'success',
          message: 'Template updated successfully!'
        });
      }

      // Reload settings
      await loadMessageSettings();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessageSettingsStatus({ type: 'idle', message: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving message settings:', error);
      setMessageSettingsStatus({
        type: 'error',
        message: 'Failed to save template'
      });
    } finally {
      setSavingMessageSettings(false);
    }
  };

  // Email configuration handlers (from EmailSettings)
  const handleEmailSave = async () => {
    if (!emailConfig.email || !emailConfig.brevoApiKey) {
      setEmailMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    if (!user?.id) {
      setEmailMessage({ type: 'error', text: 'User not authenticated' });
      return;
    }

    setIsEmailLoading(true);
    setEmailMessage(null);

    try {
      // Save to both legacy and mission tables
      const [legacyResult, missionResult] = await Promise.all([
        emailService.saveEmailConfig(emailConfig, user.id),
        supabase.from('email_settings_mission').upsert({
          user_id: user.id,
          from_email: emailConfig.email,
          smtp_password: emailConfig.brevoApiKey, // Using smtp_password for API key
          smtp_username: emailConfig.email,
          provider: 'brevo',
          is_active: true,
          updated_at: new Date().toISOString()
        })
      ]);

      if (legacyResult || !missionResult.error) {
        setEmailMessage({ type: 'success', text: 'Email configuration saved successfully!' });
      } else {
        setEmailMessage({ type: 'error', text: 'Failed to save email configuration to database' });
      }
    } catch (error) {
      console.error('Error saving email config:', error);
      setEmailMessage({ type: 'error', text: 'Failed to save email configuration' });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleEmailTest = async () => {
    console.log('=== TEST EMAIL BUTTON CLICKED ===');
    console.log('Current config:', {
      email: emailConfig.email,
      provider: emailConfig.provider,
      hasApiKey: !!emailConfig.brevoApiKey,
      apiKeyLength: emailConfig.brevoApiKey?.length || 0
    });
    console.log('Test email recipient:', testEmail);
    console.log('Test message:', testMessage);
    
    // Always use active configuration from DB (is_active = true)
    setIsEmailLoading(true);
    setEmailMessage(null);

    try {
      console.log('Calling emailService.testActiveEmailService using DB active configuration...');
      const result = await emailService.testActiveEmailService(testEmail, 'Email Configuration Test', testMessage);
      
      console.log('Test email service result:', result);
      
      if (result.success) {
        console.log('✅ Test email sent successfully using DB active configuration!');
        setEmailMessage({ type: 'success', text: 'Test email sent successfully using active configuration from database!' });
      } else {
        console.log('❌ Test email failed:', result.error);
        setEmailMessage({ type: 'error', text: `Failed to send test email: ${result.error}` });
      }
    } catch (error) {
      console.error('=== ERROR IN HANDLE TEST ===');
      console.error('Error testing email:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('=== END ERROR LOG ===');
      setEmailMessage({ type: 'error', text: 'Failed to test email configuration' });
    } finally {
      setIsEmailLoading(false);
      console.log('=== TEST EMAIL BUTTON PROCESS COMPLETED ===');
    }
  };

  const handleEmailInputChange = (field: keyof EmailConfig, value: string) => {
    setEmailConfig({ ...emailConfig, [field]: value });
    setEmailMessage(null);
    
    if (field === 'email') {
      setTestEmail(value);
    }
  };

  // Handle new account form
  const handleNewAccountFormChange = (field: keyof typeof newAccountForm, value: string) => {
    setNewAccountForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetNewAccountForm = () => {
    setNewAccountForm({
      email: '',
      brevoApiKey: '',
      provider: 'brevo'
    });
    setNewAccountStatus({ type: 'idle', message: '' });
  };

  const handleCancelNewAccount = () => {
    setShowNewAccountForm(false);
    resetNewAccountForm();
  };

  const handleSaveNewAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!newAccountForm.email.trim()) {
      setNewAccountStatus({
        type: 'error',
        message: 'Email address is required'
      });
      return;
    }

    if (!newAccountForm.brevoApiKey.trim()) {
      setNewAccountStatus({
        type: 'error',
        message: 'Brevo API Key is required'
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newAccountForm.email.trim())) {
      setNewAccountStatus({
        type: 'error',
        message: 'Please enter a valid email address'
      });
      return;
    }

    setSavingNewAccount(true);
    setNewAccountStatus({ type: 'idle', message: '' });

    try {
      const emailConfig: EmailConfig = {
        provider: newAccountForm.provider,
        email: newAccountForm.email.trim(),
        brevoApiKey: newAccountForm.brevoApiKey.trim()
      };
      
      const result = await emailService.saveEmailConfig(emailConfig, user?.id || '');

      if (result) {
        setNewAccountStatus({
          type: 'success',
          message: 'Email account added successfully!'
        });
        
        // Reset form and hide it
        resetNewAccountForm();
        setShowNewAccountForm(false);
        
        // Reload email settings
        await loadAllEmailSettings();
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setNewAccountStatus({ type: 'idle', message: '' });
        }, 3000);
      } else {
        throw new Error('Failed to save email configuration');
      }
    } catch (error) {
      console.error('Error saving new email account:', error);
      setNewAccountStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save email account'
      });
    } finally {
      setSavingNewAccount(false);
    }
  };

  const getBrevoInfo = () => {
    return { host: 'Brevo API', port: 'HTTPS' };
  };

  // Handle setting active email configuration
  const handleSetActiveEmailConfig = async (configId: string) => {
    setIsEmailLoading(true);
    try {
      const success = await emailService.setActiveEmailConfig(configId);
      if (success) {
        setSelectedEmailSetting(configId);
        setEmailMessage({ type: 'success', text: 'Email configuration set as active successfully' });
        // Reload the configurations to update the UI
        await loadAllEmailSettings();
        await loadEmailConfig();
      } else {
        setEmailMessage({ type: 'error', text: 'Failed to set email configuration as active' });
      }
    } catch (error) {
      console.error('Error setting active email config:', error);
      setEmailMessage({ type: 'error', text: 'Failed to set email configuration as active' });
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Handle deleting email configuration
  const handleDeleteEmailConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this email configuration?')) {
      return;
    }

    setIsEmailLoading(true);
    try {
      const success = await emailService.deleteEmailConfig(configId);
      if (success) {
        setEmailMessage({ type: 'success', text: 'Email configuration deleted successfully' });
        // Reload the configurations to update the UI
        await loadAllEmailSettings();
        // If the deleted config was selected, clear the selection
        if (selectedEmailSetting === configId) {
          setSelectedEmailSetting('');
        }
      } else {
        setEmailMessage({ type: 'error', text: 'Failed to delete email configuration' });
      }
    } catch (error) {
      console.error('Error deleting email config:', error);
      setEmailMessage({ type: 'error', text: 'Failed to delete email configuration' });
    } finally {
      setIsEmailLoading(false);
    }
  };

  // Utility functions
  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-6 h-6 sm:w-8 sm:h-8 text-gray-700" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600">
          Manage company banner and preview document templates
        </p>
      </div>

      {/* Error Display - Removed undefined error references */}

      {/* Tab Navigation */}
      <div className="mb-4 sm:mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-1 sm:space-x-8 sm:gap-0">
            <button
              onClick={() => setActiveTab('banners')}
              className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-w-0 ${
                activeTab === 'banners'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Image className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Banner Management</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`hidden py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-w-0 ${
                activeTab === 'preview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Eye className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Document Preview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('email')}
              className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-w-0 ${
                activeTab === 'email'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <Mail className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Email Layout Settings</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('emailSettings')}
              className={`py-2 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-w-0 ${
                activeTab === 'emailSettings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2">
                <SettingsIcon className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">Email Settings</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Banner Management Tab */}
      {activeTab === 'banners' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                Top Banner (Letterhead)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshTopBanner}
                  disabled={topBannerLoading}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${topBannerLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={handleResetTopBanner}
                  disabled={topBannerLoading || !topBanner}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            
            {/* Error Display for Top Banner */}
            {topBannerError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-medium text-red-800">Error loading top banner</p>
                </div>
                <p className="text-sm text-red-600 mt-1">{topBannerError}</p>
                <button
                  onClick={refreshTopBanner}
                  className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-md transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
              {/* Upload Section */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-800">Upload Top Banner</h3>
                <p className="text-xs sm:text-sm text-gray-600">
                  Upload a banner that will appear at the top of all document templates (letterhead area).
                </p>
                <BannerUpload 
                  bannerType="top"
                  companyName={selectedCompany}
                  onBannerUploaded={handleTopBannerUploaded}
                  currentBannerUrl={topBanner?.banner_data_url}
                />
              </div>

              {/* Current Top Banner Display */}
              <div className="space-y-4">
                <h3 className="text-base sm:text-lg font-medium text-gray-800">Current Top Banner</h3>
                
                {topBannerLoading ? (
                  <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading top banner...</p>
                    </div>
                  </div>
                ) : topBanner && topBanner.banner_data_url ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <img 
                        src={topBanner.banner_data_url} 
                        alt="Top Banner" 
                        className="w-full h-auto border border-gray-300 rounded shadow-sm"
                        style={{ maxHeight: '150px', objectFit: 'contain' }}
                        onError={(e) => {
                          console.error('Failed to display top banner image', {
                            url: topBanner.banner_data_url,
                            error: e
                          });
                          e.currentTarget.src = 'https://via.placeholder.com/800x150?text=Top+Banner+Load+Error';
                        }}
                      />
                    </div>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-900 mb-2">Banner Information</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                        <div>
                          <span className="font-medium">File Size:</span> {formatFileSize(topBanner.file_size)}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {topBanner.mime_type || 'Unknown'}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Last Updated:</span> {formatDate(topBanner.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">No top banner uploaded</p>
                      <p className="text-xs text-gray-500">Upload a banner to see it here</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Bottom Banner Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                Bottom Banner (Footer)
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshBottomBanner}
                  disabled={bottomBannerLoading}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${bottomBannerLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={handleResetBottomBanner}
                  disabled={bottomBannerLoading || !bottomBanner}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs sm:text-sm rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>
            
            {/* Error Display for Bottom Banner */}
            {bottomBannerError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-medium text-red-800">Error loading bottom banner</p>
                </div>
                <p className="text-sm text-red-600 mt-1">{bottomBannerError}</p>
                <button
                  onClick={refreshBottomBanner}
                  className="mt-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded-md transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retry
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upload Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">Upload Bottom Banner</h3>
                <p className="text-sm text-gray-600">
                  Upload a banner that will appear at the bottom of all document templates (footer area).
                </p>
                <BannerUpload 
                  bannerType="bottom"
                  companyName={selectedCompany}
                  onBannerUploaded={handleBottomBannerUploaded}
                  currentBannerUrl={bottomBanner?.banner_data_url}
                />
              </div>

              {/* Current Bottom Banner Display */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-800">Current Bottom Banner</h3>
                
                {bottomBannerLoading ? (
                  <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Loading bottom banner...</p>
                    </div>
                  </div>
                ) : bottomBanner && bottomBanner.banner_data_url ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <img 
                        src={bottomBanner.banner_data_url} 
                        alt="Bottom Banner" 
                        className="w-full h-auto border border-gray-300 rounded shadow-sm"
                        style={{ maxHeight: '150px', objectFit: 'contain' }}
                        onError={(e) => {
                          console.error('Failed to display bottom banner image', {
                            url: bottomBanner.banner_data_url,
                            error: e
                          });
                          e.currentTarget.src = 'https://via.placeholder.com/800x150?text=Bottom+Banner+Load+Error';
                        }}
                      />
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-green-900 mb-2">Banner Information</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                        <div>
                          <span className="font-medium">File Size:</span> {formatFileSize(bottomBanner.file_size)}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {bottomBanner.mime_type || 'Unknown'}
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Last Updated:</span> {formatDate(bottomBanner.updated_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">No bottom banner uploaded</p>
                      <p className="text-xs text-gray-500">Upload a banner to see it here</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Document Preview Tab */}
      {activeTab === 'preview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Document Preview with Banners
            </h2>
            
            <div className="space-y-6">
              {/* Preview Controls */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Template:</label>
                  <select 
                    value={previewType} 
                    onChange={(e) => setPreviewType(e.target.value as 'monthly_payment' | 'full_settlement')}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly_payment">Monthly Payment</option>
                    <option value="full_settlement">Full Settlement</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs sm:text-sm font-medium text-gray-700">Company:</label>
                  <select
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AEON">AEON</option>
                    <option value="COURTS (M) SDN BHD">COURTS</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Both top and bottom banners are loaded from the <code className="bg-blue-100 px-1 rounded">company_banners</code> table with banner types 'top' and 'bottom'.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Email Settings Tab */}
      {activeTab === 'email' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Layout Settings
              </h2>
            </div>

            {/* Status Messages */}
            {messageSettingsStatus.type !== 'idle' && (
              <div className={`mb-6 p-4 rounded-lg border ${
                messageSettingsStatus.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {messageSettingsStatus.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <p className="text-sm font-medium">{messageSettingsStatus.message}</p>
                </div>
              </div>
            )}

            {loadingMessageSettings ? (
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading email settings...</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveMessageSettings} className="space-y-6">
                {/* Template Management */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Email Templates
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={startCreatingNewTemplate}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        New Template
                      </button>
                      {!isCreatingNewTemplate && selectedTemplate && messageSettings.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(selectedTemplate)}
                          disabled={deletingTemplate}
                          className="px-3 py-2 text-xs sm:text-sm bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500 flex items-center gap-1.5 transition-all duration-200 min-w-[80px] justify-center"
                        >
                          {deletingTemplate ? (
                            <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          )}
                          <span className="hidden xs:inline">Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isCreatingNewTemplate ? (
                    <div className="space-y-3 p-4 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-green-800">Creating New Template</h3>
                        <button
                          type="button"
                          onClick={cancelCreatingNewTemplate}
                          className="text-green-600 hover:text-green-800"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-green-700 mb-1">
                          Template Name
                        </label>
                        <input
                          type="text"
                          value={emailForm.template_name}
                          onChange={(e) => handleEmailFormChange('template_name', e.target.value)}
                          className="w-full px-3 py-2 border border-green-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                          placeholder="Enter template name (e.g., Monthly Payment Plan)"
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      {messageSettings.length > 0 ? (
                        <select
                          value={selectedTemplate}
                          onChange={(e) => setSelectedTemplate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          {messageSettings.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.template_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Mail className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm">No email templates found</p>
                          <p className="text-xs">Click "New Template" to create your first template</p>
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {isCreatingNewTemplate 
                      ? 'Enter a name for your new email template'
                      : 'Select the email template you want to configure'
                    }
                  </p>
                </div>

                {/* Subject Field */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={(e) => handleEmailFormChange('subject', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter email subject"
                    required
                  />
                </div>

                {/* Email To */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Email to:
                  </label>
                  <input
                    type="email"
                    value={emailForm.email_to}
                    onChange={(e) => handleEmailFormChange('email_to', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter recipient email address"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Primary recipient for this template (optional).
                  </p>
                </div>

                {/* CC Emails */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    CC Email Addresses
                  </label>
                  <div className="space-y-2">
                    {emailForm.cc_emails.map((email, index) => (
                      <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => updateCCEmail(index, e.target.value)}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter CC email address"
                        />
                        {emailForm.cc_emails.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCCEmail(index)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 self-center sm:self-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCCEmail}
                      className="flex items-center justify-center sm:justify-start gap-2 px-3 py-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors w-full sm:w-auto"
                    >
                      <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                      Add CC Email
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Add email addresses that should receive a copy of the email
                  </p>
                </div>

                {/* Message Content */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Email Message Content
                  </label>
                  <textarea
                    value={emailForm.message_content}
                    onChange={(e) => handleEmailFormChange('message_content', e.target.value)}
                    rows={8}
                    className="w-full h-48 sm:h-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-xs sm:text-sm overflow-y-auto resize-none"
                    placeholder="Enter email message content..."
                    required
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-xs font-medium text-blue-900 mb-1">Available Variables (auto-detected):</p>
                    <div className="text-xs text-blue-700 space-y-1">
                      {detectedVariables.length > 0 ? (
                        detectedVariables.map((v) => (
                          <p key={v}><code className="bg-blue-100 px-1 rounded">{v}</code></p>
                        ))
                      ) : (
                        <p className="text-blue-700">No variables detected. Wrap placeholders with {'{'}variable_name{'}'}.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingMessageSettings}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingMessageSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {savingMessageSettings 
                      ? 'Saving...' 
                      : isCreatingNewTemplate 
                        ? 'Create Template' 
                        : 'Update Template'
                    }
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Email Settings Tab */}
      {activeTab === 'emailSettings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Settings
              </h2>
            </div>

            {/* Status Messages */}
            {emailMessage && (
              <div className={`mb-6 p-4 rounded-lg border ${
                emailMessage.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {emailMessage.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  <p className="text-sm font-medium">{emailMessage.text}</p>
                </div>
              </div>
            )}

            {/* Email Configurations List */}
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Available Email Configurations</h3>
                  <button
                    onClick={() => loadAllEmailSettings()}
                    disabled={loadingEmailSettings}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                  >
                    {loadingEmailSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    Refresh
                  </button>
                </div>

                {loadingEmailSettings ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                    <span className="ml-2 text-gray-500">Loading email configurations...</span>
                  </div>
                ) : emailSettingsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg font-medium">No email configurations found</p>
                    <p className="text-sm">Create a new email configuration to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emailSettingsList.map((setting) => (
                      <div
                        key={setting.id}
                        className={`border rounded-lg p-3 sm:p-4 transition-all ${
                          setting.is_active
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
                                  {setting.email || 'No email address'}
                                </h4>
                                {setting.is_active && (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full self-start">
                                    Active
                                  </span>
                                )}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-500 mt-1 space-y-0.5">
                                <p>Provider: {setting.provider || 'Unknown'}</p>
                                <p>Created: {setting.created_at ? formatDate(setting.created_at) : 'Unknown'}</p>
                                {setting.brevo_api_key && (
                                  <p>API Key: ••••••••••••{setting.brevo_api_key.slice(-4)}</p>
                                )}
                              </div>
                                
                              {/* Email Limits Display */}
                              {loadingLimits ? (
                                <div className="mt-3 p-2 sm:p-3 bg-gray-100 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin text-gray-500" />
                                    <span className="text-xs sm:text-sm text-gray-500">Loading limits...</span>
                                  </div>
                                </div>
                              ) : emailLimits[setting.id] ? (
                                <div className="mt-3 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <h5 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">Email Limits</h5>
                                  {(emailLimits[setting.id].brevoPlanName || typeof emailLimits[setting.id].brevoMonthlyRemaining === 'number') && (
                                    <div className="mb-2 text-[11px] sm:text-xs text-blue-700 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                      {emailLimits[setting.id].brevoPlanName && (
                                        <span className="inline-flex items-center gap-1">
                                          <span className="font-medium">Plan:</span>
                                          <span className="truncate max-w-[160px] sm:max-w-[240px]">{emailLimits[setting.id].brevoPlanName}</span>
                                        </span>
                                      )}
                                      {typeof emailLimits[setting.id].brevoMonthlyRemaining === 'number' && (
                                        <span className="inline-flex items-center gap-1">
                                          <span className="font-medium">Brevo Monthly Remaining:</span>
                                          <span>{emailLimits[setting.id].brevoMonthlyRemaining}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 gap-3 text-xs">
                                    <div className="space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-blue-700">Daily Remaining:</span>
                                        <span className={`font-medium ${
                                          emailLimits[setting.id].dailyRemaining <= 10 
                                            ? 'text-red-600' 
                                            : emailLimits[setting.id].dailyRemaining <= 50 
                                              ? 'text-orange-600' 
                                              : 'text-green-600'
                                        }`}>
                                          {emailLimits[setting.id].dailyRemaining}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-blue-600">
                                        <span>Daily Used:</span>
                                        <span>{emailLimits[setting.id].dailyUsage} / {emailLimits[setting.id].dailyLimit}</span>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between">
                                        <span className="text-blue-700">Monthly Remaining:</span>
                                        <span className={`font-medium ${
                                          emailLimits[setting.id].monthlyRemaining <= 100 
                                            ? 'text-red-600' 
                                            : emailLimits[setting.id].monthlyRemaining <= 500 
                                              ? 'text-orange-600' 
                                              : 'text-green-600'
                                        }`}>
                                          {emailLimits[setting.id].monthlyRemaining}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-blue-600">
                                        <span>Monthly Used:</span>
                                        <span>{emailLimits[setting.id].monthlyUsage} / {emailLimits[setting.id].monthlyLimit}</span>
                                      </div>
                                    </div>
                                  </div>
                                    
                                  {/* Progress bars */}
                                  <div className="mt-3 space-y-2">
                                    <div>
                                      <div className="flex justify-between text-xs text-blue-700 mb-1">
                                        <span>Daily Usage</span>
                                        <span>{Math.round((emailLimits[setting.id].dailyUsage / emailLimits[setting.id].dailyLimit) * 100)}%</span>
                                      </div>
                                      <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all ${
                                            (emailLimits[setting.id].dailyUsage / emailLimits[setting.id].dailyLimit) > 0.9 
                                              ? 'bg-red-500' 
                                              : (emailLimits[setting.id].dailyUsage / emailLimits[setting.id].dailyLimit) > 0.7 
                                                ? 'bg-orange-500' 
                                                : 'bg-green-500'
                                          }`}
                                          style={{ 
                                            width: `${Math.min((emailLimits[setting.id].dailyUsage / emailLimits[setting.id].dailyLimit) * 100, 100)}%` 
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="flex justify-between text-xs text-blue-700 mb-1">
                                        <span>Monthly Usage</span>
                                        <span>{Math.round((emailLimits[setting.id].monthlyUsage / emailLimits[setting.id].monthlyLimit) * 100)}%</span>
                                      </div>
                                      <div className="w-full bg-blue-200 rounded-full h-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all ${
                                            (emailLimits[setting.id].monthlyUsage / emailLimits[setting.id].monthlyLimit) > 0.9 
                                              ? 'bg-red-500' 
                                              : (emailLimits[setting.id].monthlyUsage / emailLimits[setting.id].monthlyLimit) > 0.7 
                                                ? 'bg-orange-500' 
                                                : 'bg-green-500'
                                          }`}
                                          style={{ 
                                            width: `${Math.min((emailLimits[setting.id].monthlyUsage / emailLimits[setting.id].monthlyLimit) * 100, 100)}%` 
                                          }}
                                        ></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-4">
                            {!setting.is_active && (
                              <button
                                onClick={() => handleSetActiveEmailConfig(setting.id)}
                                disabled={isEmailLoading}
                                className="px-3 py-2 text-xs sm:text-sm bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5"
                              >
                                <span className="sm:hidden">Set Active</span>
                                <span className="hidden sm:inline">Set Active</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteEmailConfig(setting.id)}
                              disabled={isEmailLoading}
                              className="px-3 py-2 text-xs sm:text-sm bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-500 flex items-center gap-1.5 transition-all duration-200 justify-center"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              <span className="sm:hidden">Delete</span>
                              <span className="hidden sm:inline">Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Account Button */}
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setShowNewAccountForm(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Brevo Account
                  </button>
                </div>
              </div>

              {/* New Account Form */}
              {showNewAccountForm && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Add New Brevo Account
                    </h3>
                    <button
                      onClick={handleCancelNewAccount}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Status Messages for New Account */}
                  {newAccountStatus.type !== 'idle' && (
                    <div className={`mb-6 p-4 rounded-lg border ${
                      newAccountStatus.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      <div className="flex items-center gap-2">
                        {newAccountStatus.type === 'success' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <AlertCircle className="w-5 h-5" />
                        )}
                        <p className="text-sm font-medium">{newAccountStatus.message}</p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSaveNewAccount} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={newAccountForm.email}
                        onChange={(e) => handleNewAccountFormChange('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="your-email@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Brevo API Key *
                      </label>
                      <input
                        type="password"
                        value={newAccountForm.brevoApiKey}
                        onChange={(e) => handleNewAccountFormChange('brevoApiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter your Brevo API key"
                        required
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        You can find your API key in your Brevo account settings
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Provider
                      </label>
                      <select
                        value={newAccountForm.provider}
                        onChange={(e) => handleNewAccountFormChange('provider', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="brevo">Brevo</option>
                      </select>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pt-4">
                      <button
                        type="submit"
                        disabled={savingNewAccount}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        {savingNewAccount ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Account
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelNewAccount}
                        disabled={savingNewAccount}
                        className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Current Active Configuration Details */}
              {emailConfig.email && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Current Active Configuration</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Email:</strong> {emailConfig.email}</p>
                    <p><strong>Provider:</strong> {emailConfig.provider}</p>
                    <p><strong>API Key:</strong> ••••••••••••{emailConfig.brevoApiKey.slice(-4)}</p>
                  </div>
                  
                  {/* Test Email Section */}
                  <div className="mt-6 pt-4 border-t border-blue-200">
                    <h4 className="text-base font-medium text-gray-900 mb-4">Test Email Configuration</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Test Email Recipient
                        </label>
                        <input
                          type="email"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="test@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Test Message
                        </label>
                        <textarea
                          value={testMessage}
                          onChange={(e) => setTestMessage(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter test message content..."
                        />
                      </div>

                      <button
                        onClick={handleEmailTest}
                        disabled={isEmailLoading || !testEmail}
                        className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isEmailLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Beaker className="w-4 h-4" />
                        )}
                        {isEmailLoading ? 'Sending...' : 'Send Test Email'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Add runtime resolver to avoid cross-origin when hosted
const resolveApiBase = (): string => {
  const envBase = import.meta.env.VITE_API_BASE;
  try {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isHosted = !hostname.includes('localhost');
      const isFlyBackend = typeof envBase === 'string' && envBase.includes('fly.dev');
      if (isHosted && isFlyBackend) return '';
    }
  } catch (_) {}
  return envBase || '';
};

export default Settings;