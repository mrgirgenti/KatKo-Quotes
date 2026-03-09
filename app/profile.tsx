import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  User,
  Building2,
  Mail,
  Phone,
  Check,
  Plus,
  ChevronRight,
  Trash2,
  BarChart3,
  Lock,
  Eye,
  EyeOff,
  Sheet,
  Camera,
  RefreshCw,
  HelpCircle,
  Copy,
  ExternalLink,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { GOOGLE_SCRIPT_TEMPLATE } from '@/utils/googleSheetsExport';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { AVATAR_COLORS, UserProfile } from '@/types/user';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, users, updateUser, createUser, switchUser, deleteUser, isUpdating } = useUser();

  const [name, setName] = useState(currentUser?.name || '');
  const [businessName, setBusinessName] = useState(currentUser?.businessName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [selectedColor, setSelectedColor] = useState(currentUser?.avatarColor || AVATAR_COLORS[0]);
  const [showUserList, setShowUserList] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [showNewUserInput, setShowNewUserInput] = useState(false);
  const [adminPassword, setAdminPassword] = useState(currentUser?.adminPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [isEditingSheets, setIsEditingSheets] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(currentUser?.googleSheetsUrl || '');
  const [profilePicture, setProfilePicture] = useState(currentUser?.profilePicture || '');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [pendingAction, setPendingAction] = useState<'editPassword' | 'editSheets' | null>(null);
  const [showScriptHelp, setShowScriptHelp] = useState(false);

  const isPasswordLocked = currentUser?.adminPasswordLocked && currentUser?.adminPassword;
  const isSheetsLocked = currentUser?.googleSheetsUrl && currentUser?.adminPassword;

  React.useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setBusinessName(currentUser.businessName);
      setEmail(currentUser.email);
      setPhone(currentUser.phone);
      setSelectedColor(currentUser.avatarColor);
      setAdminPassword(currentUser.adminPassword || '');
      setGoogleSheetsUrl(currentUser.googleSheetsUrl || '');
      setProfilePicture(currentUser.profilePicture || '');
    }
  }, [currentUser]);

  const pickProfilePicture = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setProfilePicture(result.assets[0].uri);
    }
  }, []);

  const removeProfilePicture = useCallback(() => {
    Alert.alert('Remove Photo', 'Are you sure you want to remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setProfilePicture('') },
    ]);
  }, []);

  const verifyAdminPassword = useCallback((action: 'editPassword' | 'editSheets') => {
    if (!currentUser?.adminPassword) {
      return true;
    }
    setPendingAction(action);
    setPasswordInput('');
    setShowPasswordPrompt(true);
    return false;
  }, [currentUser?.adminPassword]);

  const handlePasswordVerification = useCallback(() => {
    if (passwordInput === currentUser?.adminPassword) {
      setShowPasswordPrompt(false);
      setPasswordInput('');
      if (pendingAction === 'editPassword') {
        setIsEditingPassword(true);
        setAdminPassword('');
        Alert.alert(
          'Edit Admin Password',
          'You can now enter a new admin password below.',
          [{ text: 'OK' }]
        );
      } else if (pendingAction === 'editSheets') {
        setIsEditingSheets(true);
        Alert.alert(
          'Edit Google Sheets URL',
          'You can now edit the Google Sheets URL below.',
          [{ text: 'OK' }]
        );
      }
      setPendingAction(null);
    } else {
      Alert.alert('Incorrect Password', 'The admin password you entered is incorrect.');
    }
  }, [passwordInput, currentUser?.adminPassword, pendingAction]);

  const handleResetPasswordByEmail = useCallback(() => {
    if (!currentUser?.email) {
      Alert.alert('No Email', 'Please add an email address to your profile first.');
      return;
    }
    Alert.alert(
      'Reset Admin Password',
      `A password reset link will be sent to ${currentUser.email}. For now, we'll clear your admin password so you can set a new one.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Password',
          onPress: () => {
            if (currentUser) {
              const updatedUser: UserProfile = {
                ...currentUser,
                adminPassword: '',
                adminPasswordLocked: false,
              };
              updateUser(updatedUser);
              setAdminPassword('');
              setShowPasswordPrompt(false);
              Alert.alert('Password Reset', 'Your admin password has been cleared. Please set a new password.');
            }
          },
        },
      ]
    );
  }, [currentUser, updateUser]);

  const handleSave = useCallback(() => {
    if (!currentUser) return;
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const isSettingNewPassword = adminPassword.trim() && (!currentUser.adminPasswordLocked || isEditingPassword);

    const updatedUser: UserProfile = {
      ...currentUser,
      name: name.trim(),
      businessName: businessName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatarColor: selectedColor,
      isAdmin: true,
      adminPassword: isEditingPassword ? adminPassword.trim() : (adminPassword.trim() || currentUser.adminPassword || ''),
      adminPasswordLocked: isSettingNewPassword ? true : currentUser.adminPasswordLocked,
      googleSheetsUrl: googleSheetsUrl.trim(),
      profilePicture,
    };

    updateUser(updatedUser);
    setIsEditingPassword(false);
    setIsEditingSheets(false);
    setShowPassword(false);
    
    if (isSettingNewPassword) {
      Alert.alert('Success', 'Profile updated and admin password is now locked. You will need to enter it to make changes.');
    } else {
      Alert.alert('Success', 'Profile updated successfully');
    }
  }, [currentUser, name, businessName, email, phone, selectedColor, updateUser, adminPassword, googleSheetsUrl, profilePicture, isEditingPassword]);

  const handleCreateUser = useCallback(async () => {
    if (!newUserName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    await createUser(newUserName.trim());
    setNewUserName('');
    setShowNewUserInput(false);
    setShowUserList(false);
  }, [newUserName, createUser]);

  const handleSwitchUser = useCallback(async (userId: string) => {
    await switchUser(userId);
    setShowUserList(false);
  }, [switchUser]);

  const handleDeleteUser = useCallback((user: UserProfile) => {
    if (users.length <= 1) {
      Alert.alert('Error', 'You must have at least one user');
      return;
    }
    
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${user.name}"? This will also delete all their quotes and sales data.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (currentUser?.id === user.id) {
              const otherUser = users.find((u) => u.id !== user.id);
              if (otherUser) {
                switchUser(otherUser.id);
              }
            }
            deleteUser(user.id);
          },
        },
      ]
    );
  }, [users, currentUser, switchUser, deleteUser]);

  const getInitials = (userName: string) => {
    return userName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAdminPasswordFocus = useCallback(() => {
    if (isPasswordLocked && !isEditingPassword) {
      verifyAdminPassword('editPassword');
    }
  }, [isPasswordLocked, isEditingPassword, verifyAdminPassword]);

  const handleGoogleSheetsFocus = useCallback(() => {
    if (isSheetsLocked && !isEditingSheets) {
      verifyAdminPassword('editSheets');
    }
  }, [isSheetsLocked, isEditingSheets, verifyAdminPassword]);

  const handleGoogleSheetsPress = useCallback(() => {
    if (isSheetsLocked && !isEditingSheets) {
      verifyAdminPassword('editSheets');
    }
  }, [isSheetsLocked, isEditingSheets, verifyAdminPassword]);

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: 'Profile',
          headerStyle: { backgroundColor: Colors.light.headerBg },
          headerTintColor: '#fff',
        }}
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.userSwitchCard}
          onPress={() => setShowUserList(!showUserList)}
        >
          {profilePicture ? (
            <Image source={{ uri: profilePicture }} style={styles.avatarLargeImage} />
          ) : (
            <View style={[styles.avatarLarge, { backgroundColor: currentUser.avatarColor }]}>
              <Text style={styles.avatarTextLarge}>{getInitials(currentUser.name)}</Text>
            </View>
          )}
          <View style={styles.userSwitchInfo}>
            <Text style={styles.currentUserName}>{currentUser.name}</Text>
            <Text style={styles.switchLabel}>Tap to switch users</Text>
          </View>
          <ChevronRight size={20} color={Colors.light.textSecondary} />
        </TouchableOpacity>

        {showUserList && (
          <View style={styles.userListCard}>
            <Text style={styles.userListTitle}>Switch User</Text>
            {users.map((user) => (
              <View key={user.id} style={styles.userListItemContainer}>
                <TouchableOpacity
                  style={styles.userListItem}
                  onPress={() => handleSwitchUser(user.id)}
                >
                  {user.profilePicture ? (
                    <Image source={{ uri: user.profilePicture }} style={styles.avatarSmallImage} />
                  ) : (
                    <View style={[styles.avatarSmall, { backgroundColor: user.avatarColor }]}>
                      <Text style={styles.avatarTextSmall}>{getInitials(user.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.userListName}>{user.name}</Text>
                  {user.id === currentUser.id && (
                    <Check size={18} color={Colors.light.success} />
                  )}
                </TouchableOpacity>
                {user.id !== currentUser.id && (
                  <TouchableOpacity
                    style={styles.deleteUserBtn}
                    onPress={() => handleDeleteUser(user)}
                  >
                    <Trash2 size={16} color={Colors.light.error} />
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {showNewUserInput ? (
              <View style={styles.newUserRow}>
                <TextInput
                  style={styles.newUserInput}
                  placeholder="Enter name"
                  placeholderTextColor={Colors.light.textSecondary}
                  value={newUserName}
                  onChangeText={setNewUserName}
                  autoFocus
                />
                <TouchableOpacity style={styles.addUserBtn} onPress={handleCreateUser}>
                  <Check size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addNewUserBtn}
                onPress={() => setShowNewUserInput(true)}
              >
                <Plus size={18} color={Colors.light.tint} />
                <Text style={styles.addNewUserText}>Add New User</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Picture</Text>
          <View style={styles.card}>
            <View style={styles.profilePictureContainer}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.profilePicturePreview} />
              ) : (
                <View style={[styles.profilePicturePlaceholder, { backgroundColor: selectedColor }]}>
                  <Camera size={32} color="#fff" />
                </View>
              )}
              <View style={styles.profilePictureActions}>
                <TouchableOpacity style={styles.profilePictureBtn} onPress={pickProfilePicture}>
                  <Camera size={18} color={Colors.light.tint} />
                  <Text style={styles.profilePictureBtnText}>
                    {profilePicture ? 'Change Photo' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
                {profilePicture && (
                  <TouchableOpacity style={styles.profilePictureRemoveBtn} onPress={removeProfilePicture}>
                    <Trash2 size={18} color={Colors.light.error} />
                    <Text style={styles.profilePictureRemoveBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <User size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.light.textSecondary}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Building2 size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Business Name</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="Your business name"
                placeholderTextColor={Colors.light.textSecondary}
                value={businessName}
                onChangeText={setBusinessName}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Mail size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Email</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor={Colors.light.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Phone size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Phone</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor={Colors.light.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avatar Color</Text>
          <View style={styles.card}>
            <Text style={styles.inputHint}>Used when no profile picture is set</Text>
            <View style={styles.colorGrid}>
              {AVATAR_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorOptionSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                >
                  {selectedColor === color && <Check size={20} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Settings</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Lock size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Admin Password</Text>
                {isPasswordLocked && (
                  <View style={styles.lockedBadge}>
                    <Lock size={12} color={Colors.light.warning} />
                    <Text style={styles.lockedBadgeText}>Locked</Text>
                  </View>
                )}
              </View>
              <Text style={styles.inputHint}>
                {isPasswordLocked 
                  ? 'Password is locked. Tap the field to unlock with current password.' 
                  : 'Used to unlock locked sales and protect settings. Once set, it will be locked.'}
              </Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={isPasswordLocked && !isEditingPassword ? '••••••••' : 'Set admin password'}
                  placeholderTextColor={Colors.light.textSecondary}
                  value={isPasswordLocked && !isEditingPassword ? '' : adminPassword}
                  onChangeText={setAdminPassword}
                  secureTextEntry={isPasswordLocked && !isEditingPassword ? true : !showPassword}
                  editable={!isPasswordLocked || isEditingPassword}
                  onFocus={handleAdminPasswordFocus}
                />
                {(!isPasswordLocked || isEditingPassword) && (
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff size={20} color={Colors.light.textSecondary} />
                    ) : (
                      <Eye size={20} color={Colors.light.textSecondary} />
                    )}
                  </TouchableOpacity>
                )}
                {isPasswordLocked && !isEditingPassword && (
                  <View style={styles.passwordToggle}>
                    <Lock size={20} color={Colors.light.textSecondary} />
                  </View>
                )}
              </View>
              {isPasswordLocked && (
                <TouchableOpacity 
                  style={styles.resetPasswordLink}
                  onPress={handleResetPasswordByEmail}
                >
                  <RefreshCw size={14} color={Colors.light.tint} />
                  <Text style={styles.resetPasswordLinkText}>Forgot password? Reset via email</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <Sheet size={16} color={Colors.light.textSecondary} />
                <Text style={styles.inputLabelText}>Google Sheets Web App URL</Text>
                {isSheetsLocked && (
                  <View style={styles.lockedBadge}>
                    <Lock size={12} color={Colors.light.warning} />
                    <Text style={styles.lockedBadgeText}>Protected</Text>
                  </View>
                )}
              </View>
              <Text style={styles.inputHint}>
                {isSheetsLocked 
                  ? 'Protected by admin password. Tap to edit.' 
                  : 'Paste your Google Apps Script web app URL to export sales directly'}
              </Text>
              <TouchableOpacity
                activeOpacity={1}
                onPress={handleGoogleSheetsPress}
                style={styles.urlInputWrapper}
              >
                <TextInput
                  style={[styles.input, styles.urlInput]}
                  placeholder="https://script.google.com/macros/s/..."
                  placeholderTextColor={Colors.light.textSecondary}
                  value={googleSheetsUrl}
                  onChangeText={setGoogleSheetsUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  editable={!isSheetsLocked || isEditingSheets}
                  onFocus={handleGoogleSheetsFocus}
                  multiline={false}
                  returnKeyType="done"
                  textContentType="URL"
                  pointerEvents={isSheetsLocked && !isEditingSheets ? 'none' : 'auto'}
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.setupHelpBtn}
                onPress={() => setShowScriptHelp(true)}
              >
                <HelpCircle size={14} color={Colors.light.tint} />
                <Text style={styles.setupHelpBtnText}>How to set up Google Sheets integration</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isUpdating}
        >
          <Text style={styles.saveButtonText}>{isUpdating ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports & Export</Text>
          <TouchableOpacity
            style={styles.reportCard}
            onPress={() => router.push('/reports')}
          >
            <View style={styles.reportCardLeft}>
              <View style={styles.reportIcon}>
                <BarChart3 size={22} color={Colors.light.tint} />
              </View>
              <View>
                <Text style={styles.reportTitle}>View Reports</Text>
                <Text style={styles.reportDesc}>Filter and export quotes & sales data</Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.light.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {showScriptHelp && (
        <View style={styles.passwordPromptOverlay}>
          <View style={styles.scriptHelpCard}>
            <View style={styles.scriptHelpHeader}>
              <Text style={styles.scriptHelpTitle}>Google Sheets Setup</Text>
              <TouchableOpacity onPress={() => setShowScriptHelp(false)}>
                <ExternalLink size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.scriptHelpContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.scriptHelpStep}>Step 1: Create a new Google Sheet</Text>
              <Text style={styles.scriptHelpText}>Open Google Sheets and create a new blank spreadsheet for your sales data.</Text>
              
              <Text style={styles.scriptHelpStep}>Step 2: Open Apps Script</Text>
              <Text style={styles.scriptHelpText}>Go to Extensions → Apps Script</Text>
              
              <Text style={styles.scriptHelpStep}>Step 3: Paste the script</Text>
              <Text style={styles.scriptHelpText}>Delete any existing code and paste the script below. Then click the copy button.</Text>
              
              <View style={styles.scriptCodeBox}>
                <Text style={styles.scriptCodeText} numberOfLines={8}>
                  {GOOGLE_SCRIPT_TEMPLATE.trim().substring(0, 500)}...
                </Text>
                <TouchableOpacity 
                  style={styles.copyScriptBtn}
                  onPress={async () => {
                    await Clipboard.setStringAsync(GOOGLE_SCRIPT_TEMPLATE.trim());
                    Alert.alert('Copied!', 'Script copied to clipboard. Paste it in Google Apps Script.');
                  }}
                >
                  <Copy size={16} color="#fff" />
                  <Text style={styles.copyScriptBtnText}>Copy Full Script</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.scriptHelpStep}>Step 4: Deploy as Web App</Text>
              <Text style={styles.scriptHelpText}>
                {"1. Click \"Deploy\" → \"New deployment\"\n2. Select \"Web app\" as type\n3. Set \"Execute as\" to \"Me\"\n4. Set \"Who has access\" to \"Anyone\"\n5. Click \"Deploy\" and authorize"}
              </Text>
              
              <Text style={styles.scriptHelpStep}>Step 5: Copy the Web App URL</Text>
              <Text style={styles.scriptHelpText}>Copy the URL that starts with https://script.google.com/macros/s/... and paste it above.</Text>
              
              <View style={styles.scriptHelpNote}>
                <Text style={styles.scriptHelpNoteText}>Note: The URL must be the Web App URL, not the regular Google Sheets URL.</Text>
              </View>
            </ScrollView>
            <TouchableOpacity 
              style={styles.scriptHelpCloseBtn}
              onPress={() => setShowScriptHelp(false)}
            >
              <Text style={styles.scriptHelpCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showPasswordPrompt && (
        <View style={styles.passwordPromptOverlay}>
          <View style={styles.passwordPromptCard}>
            <Text style={styles.passwordPromptTitle}>Enter Admin Password</Text>
            <Text style={styles.passwordPromptDesc}>
              {pendingAction === 'editPassword' 
                ? 'Enter your current password to change it' 
                : 'Enter your admin password to edit the Google Sheets URL'}
            </Text>
            <View style={styles.passwordPromptInputContainer}>
              <TextInput
                style={styles.passwordPromptInput}
                placeholder="Admin password"
                placeholderTextColor={Colors.light.textSecondary}
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry
                autoFocus
              />
            </View>
            <View style={styles.passwordPromptActions}>
              <TouchableOpacity 
                style={styles.passwordPromptCancelBtn}
                onPress={() => {
                  setShowPasswordPrompt(false);
                  setPasswordInput('');
                  setPendingAction(null);
                }}
              >
                <Text style={styles.passwordPromptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.passwordPromptConfirmBtn}
                onPress={handlePasswordVerification}
              >
                <Text style={styles.passwordPromptConfirmText}>Verify</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity 
              style={styles.forgotPasswordBtn}
              onPress={handleResetPasswordByEmail}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  userSwitchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarTextLarge: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#fff',
  },
  userSwitchInfo: {
    flex: 1,
    marginLeft: 14,
  },
  currentUserName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  switchLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  userListCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  userListTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
    marginBottom: 10,
  },
  userListItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userListItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSmallImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarTextSmall: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#fff',
  },
  userListName: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    marginLeft: 12,
  },
  deleteUserBtn: {
    padding: 10,
    marginLeft: 8,
  },
  newUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  newUserInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
  },
  addUserBtn: {
    backgroundColor: Colors.light.tint,
    padding: 10,
    borderRadius: 8,
  },
  addNewUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 6,
  },
  addNewUserText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inputLabelText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  urlInput: {
    minHeight: 48,
  },
  urlInputWrapper: {
    width: '100%',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  colorOption: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  bottomPadding: {
    height: 60,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 8,
    marginTop: -2,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.light.text,
  },
  passwordToggle: {
    padding: 12,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  reportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  reportDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  profilePictureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  profilePicturePreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profilePicturePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePictureActions: {
    flex: 1,
    gap: 8,
  },
  profilePictureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
  },
  profilePictureBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  profilePictureRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  profilePictureRemoveBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.light.error,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.light.warningBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.light.warning,
  },
  resetPasswordLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  resetPasswordLinkText: {
    fontSize: 13,
    color: Colors.light.tint,
  },
  passwordPromptOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  passwordPromptCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  passwordPromptTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  passwordPromptDesc: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  passwordPromptInputContainer: {
    marginBottom: 20,
  },
  passwordPromptInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  passwordPromptActions: {
    flexDirection: 'row',
    gap: 12,
  },
  passwordPromptCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  passwordPromptCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  passwordPromptConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  passwordPromptConfirmText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  forgotPasswordBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.light.tint,
  },
  setupHelpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  setupHelpBtnText: {
    fontSize: 13,
    color: Colors.light.tint,
  },
  scriptHelpCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '85%',
  },
  scriptHelpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scriptHelpTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  scriptHelpContent: {
    maxHeight: 400,
  },
  scriptHelpStep: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginTop: 16,
    marginBottom: 6,
  },
  scriptHelpText: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  scriptCodeBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  scriptCodeText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d4',
    lineHeight: 16,
  },
  copyScriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  copyScriptBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  scriptHelpNote: {
    backgroundColor: Colors.light.warningBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  scriptHelpNoteText: {
    fontSize: 13,
    color: Colors.light.warning,
    fontWeight: '500' as const,
  },
  scriptHelpCloseBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  scriptHelpCloseBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
