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
  Image as ImageIcon,
  Globe,
  Link,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { GOOGLE_SCRIPT_TEMPLATE } from '@/utils/googleSheetsExport';
import * as ImagePicker from 'expo-image-picker';
import Colors from '@/constants/colors';
import { useUser } from '@/contexts/UserContext';
import { AVATAR_COLORS, UserProfile } from '@/types/user';
import { CropModal } from '@/components/CropModal';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, users, updateUser, createUser, deleteUser, isUpdating, isOrgAdmin } = useUser();

  const [name, setName] = useState(currentUser?.name || '');
  const [businessName, setBusinessName] = useState(currentUser?.businessName || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [selectedColor, setSelectedColor] = useState(currentUser?.avatarColor || AVATAR_COLORS[0]);
  const [profilePicture, setProfilePicture] = useState(currentUser?.profilePicture || '');

  const [companyLogo, setCompanyLogo] = useState(currentUser?.companyLogo || '');
  const [adminPassword, setAdminPassword] = useState(currentUser?.adminPassword || '');
  const [showPassword, setShowPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState(currentUser?.googleSheetsUrl || '');
  const [waveAccountingUrl, setWaveAccountingUrl] = useState(currentUser?.waveAccountingUrl || '');
  const [waveApiKey, setWaveApiKey] = useState(currentUser?.waveApiKey || '');
  const [vendorCatalogUrls, setVendorCatalogUrls] = useState(currentUser?.vendorCatalogUrls || '');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'org_admin' | 'user'>('user');
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showScriptHelp, setShowScriptHelp] = useState(false);
  const [showApiSection, setShowApiSection] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(true);

  const [cropModal, setCropModal] = useState<{
    visible: boolean;
    uri: string;
    aspect: [number, number];
    title: string;
    target: 'profile' | 'logo';
  }>({ visible: false, uri: '', aspect: [1, 1], title: '', target: 'profile' });

  const isPasswordLocked = currentUser?.adminPasswordLocked && currentUser?.adminPassword;

  React.useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setBusinessName(currentUser.businessName);
      setEmail(currentUser.email);
      setPhone(currentUser.phone);
      setSelectedColor(currentUser.avatarColor);
      setProfilePicture(currentUser.profilePicture || '');
      setCompanyLogo(currentUser.companyLogo || '');
      setAdminPassword(currentUser.adminPassword || '');
      setGoogleSheetsUrl(currentUser.googleSheetsUrl || '');
      setWaveAccountingUrl(currentUser.waveAccountingUrl || '');
      setWaveApiKey(currentUser.waveApiKey || '');
      setVendorCatalogUrls(currentUser.vendorCatalogUrls || '');
    }
  }, [currentUser]);

  const getInitials = (userName: string) =>
    userName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const pickProfilePicture = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setCropModal({ visible: true, uri: result.assets[0].uri, aspect: [1, 1], title: 'Crop Profile Photo', target: 'profile' });
    }
  }, []);

  const removeProfilePicture = useCallback(() => {
    Alert.alert('Remove Photo', 'Remove your profile photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setProfilePicture('') },
    ]);
  }, []);

  const pickCompanyLogo = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setCropModal({ visible: true, uri: result.assets[0].uri, aspect: [4, 1], title: 'Crop Company Logo', target: 'logo' });
    }
  }, []);

  const handleCropConfirm = useCallback((croppedUri: string) => {
    if (cropModal.target === 'profile') {
      setProfilePicture(croppedUri);
    } else {
      setCompanyLogo(croppedUri);
    }
    setCropModal((m) => ({ ...m, visible: false }));
  }, [cropModal.target]);

  const handleCropCancel = useCallback(() => {
    setCropModal((m) => ({ ...m, visible: false }));
  }, []);

  const removeCompanyLogo = useCallback(() => {
    Alert.alert('Remove Logo', 'Remove your company logo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setCompanyLogo('') },
    ]);
  }, []);

  const handleSave = useCallback(() => {
    if (!currentUser) return;
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const isSettingNewPassword =
      adminPassword.trim() && (!currentUser.adminPasswordLocked || isEditingPassword);

    const updatedUser: UserProfile = {
      ...currentUser,
      name: name.trim(),
      businessName: businessName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      avatarColor: selectedColor,
      profilePicture,
      ...(isOrgAdmin() && {
        companyLogo,
        adminPassword: isEditingPassword
          ? adminPassword.trim()
          : adminPassword.trim() || currentUser.adminPassword || '',
        adminPasswordLocked: isSettingNewPassword ? true : currentUser.adminPasswordLocked,
        googleSheetsUrl: googleSheetsUrl.trim(),
        waveAccountingUrl: waveAccountingUrl.trim(),
        waveApiKey: waveApiKey.trim(),
        vendorCatalogUrls: vendorCatalogUrls.trim(),
      }),
    };

    updateUser(updatedUser);
    setIsEditingPassword(false);
    setShowPassword(false);

    if (isSettingNewPassword) {
      Alert.alert(
        'Saved',
        'Profile updated. Admin password is now locked — you will need it to make changes.'
      );
    } else {
      Alert.alert('Saved', 'Profile updated successfully.');
    }
  }, [
    currentUser,
    name,
    businessName,
    email,
    phone,
    selectedColor,
    profilePicture,
    companyLogo,
    adminPassword,
    googleSheetsUrl,
    waveAccountingUrl,
    waveApiKey,
    vendorCatalogUrls,
    updateUser,
    isEditingPassword,
    isOrgAdmin,
  ]);

  const handlePasswordVerification = useCallback(() => {
    if (passwordInput === currentUser?.adminPassword) {
      setShowPasswordPrompt(false);
      setPasswordInput('');
      setIsEditingPassword(true);
      setAdminPassword('');
    } else {
      Alert.alert('Incorrect Password', 'The admin password you entered is incorrect.');
    }
  }, [passwordInput, currentUser?.adminPassword]);

  const handleResetPasswordByEmail = useCallback(() => {
    if (!currentUser?.email) {
      Alert.alert('No Email', 'Please add an email address to your profile first.');
      return;
    }
    Alert.alert(
      'Reset Admin Password',
      `A password reset link will be sent to ${currentUser.email}. This will clear your current admin password.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          onPress: () => {
            if (currentUser) {
              updateUser({ ...currentUser, adminPassword: '', adminPasswordLocked: false });
              setAdminPassword('');
              setShowPasswordPrompt(false);
              Alert.alert('Password Reset', 'Admin password cleared. Please set a new one.');
            }
          },
        },
      ]
    );
  }, [currentUser, updateUser]);

  const handleCreateUser = useCallback(async () => {
    if (!newUserName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }
    await createUser(newUserName.trim(), newUserEmail.trim(), newUserRole);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserRole('user');
    setShowNewUserForm(false);
  }, [newUserName, newUserEmail, newUserRole, createUser]);

  const handleDeleteUser = useCallback(
    (user: UserProfile) => {
      if (user.role === 'org_admin') {
        Alert.alert('Cannot Delete', 'You cannot delete the Organization Admin.');
        return;
      }
      if (users.length <= 1) {
        Alert.alert('Error', 'You must have at least one user.');
        return;
      }
      Alert.alert(
        'Delete User',
        `Delete "${user.name}"? This will also delete their quotes and sales data.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteUser(user.id),
          },
        ]
      );
    },
    [users, deleteUser]
  );

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

  const orgAdmin = isOrgAdmin();

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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Photo</Text>
          <View style={styles.card}>
            <View style={styles.photoRow}>
              <TouchableOpacity onPress={pickProfilePicture}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.photoPreview} />
                ) : (
                  <View style={[styles.photoPicturePlaceholder, { backgroundColor: selectedColor }]}>
                    <Text style={styles.photoInitials}>{getInitials(currentUser.name)}</Text>
                  </View>
                )}
                <View style={styles.cameraOverlay}>
                  <Camera size={14} color="#fff" />
                </View>
              </TouchableOpacity>

              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoBtn} onPress={pickProfilePicture}>
                  <Camera size={15} color={Colors.light.tint} />
                  <Text style={styles.photoBtnText}>
                    {profilePicture ? 'Change Photo' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
                {profilePicture && (
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={removeProfilePicture}>
                    <Trash2 size={15} color={Colors.light.error} />
                    <Text style={styles.photoRemoveBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.colorDivider} />
            <Text style={styles.colorLabel}>Avatar Color</Text>
            <Text style={styles.inputHint}>Used when no photo is set</Text>
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
                  {selectedColor === color && <Check size={18} color="#fff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <View style={styles.inputLabel}>
                <User size={15} color={Colors.light.textSecondary} />
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
                <Building2 size={15} color={Colors.light.textSecondary} />
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
                <Mail size={15} color={Colors.light.textSecondary} />
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

            <View style={[styles.inputGroup, { marginBottom: 0 }]}>
              <View style={styles.inputLabel}>
                <Phone size={15} color={Colors.light.textSecondary} />
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

        <TouchableOpacity
          style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isUpdating}
        >
          <Text style={styles.saveButtonText}>{isUpdating ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>

        {orgAdmin && (
          <>
            <View style={styles.orgHeader}>
              <Shield size={18} color={Colors.light.tint} />
              <Text style={styles.orgHeaderText}>Organization Settings</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Company Logo</Text>
              <View style={styles.card}>
                <View style={styles.logoRow}>
                  {companyLogo ? (
                    <Image source={{ uri: companyLogo }} style={styles.logoPreview} resizeMode="contain" />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <ImageIcon size={28} color={Colors.light.textSecondary} />
                      <Text style={styles.logoPlaceholderText}>No logo</Text>
                    </View>
                  )}
                  <View style={styles.logoActions}>
                    <TouchableOpacity style={styles.photoBtn} onPress={pickCompanyLogo}>
                      <Camera size={15} color={Colors.light.tint} />
                      <Text style={styles.photoBtnText}>{companyLogo ? 'Change' : 'Upload Logo'}</Text>
                    </TouchableOpacity>
                    {companyLogo && (
                      <TouchableOpacity style={styles.photoRemoveBtn} onPress={removeCompanyLogo}>
                        <Trash2 size={15} color={Colors.light.error} />
                        <Text style={styles.photoRemoveBtnText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <Text style={styles.inputHint}>Displayed in the sidebar. Recommended 4:1 ratio.</Text>
              </View>
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setShowApiSection(!showApiSection)}
              >
                <Text style={styles.sectionTitle}>API Integrations</Text>
                {showApiSection ? (
                  <ChevronUp size={18} color={Colors.light.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={Colors.light.textSecondary} />
                )}
              </TouchableOpacity>

              {showApiSection && (
                <View style={styles.card}>
                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabel}>
                      <Globe size={15} color={Colors.light.textSecondary} />
                      <Text style={styles.inputLabelText}>Wave Accounting URL</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="https://..."
                      placeholderTextColor={Colors.light.textSecondary}
                      value={waveAccountingUrl}
                      onChangeText={setWaveAccountingUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabel}>
                      <Lock size={15} color={Colors.light.textSecondary} />
                      <Text style={styles.inputLabelText}>Wave API Key</Text>
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Wave API key"
                      placeholderTextColor={Colors.light.textSecondary}
                      value={waveApiKey}
                      onChangeText={setWaveApiKey}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabel}>
                      <Link size={15} color={Colors.light.textSecondary} />
                      <Text style={styles.inputLabelText}>Vendor Catalog URLs</Text>
                    </View>
                    <Text style={styles.inputHint}>One URL per line</Text>
                    <TextInput
                      style={[styles.input, styles.multilineInput]}
                      placeholder="https://vendor1.com/catalog&#10;https://vendor2.com/catalog"
                      placeholderTextColor={Colors.light.textSecondary}
                      value={vendorCatalogUrls}
                      onChangeText={setVendorCatalogUrls}
                      autoCapitalize="none"
                      autoCorrect={false}
                      multiline
                      numberOfLines={3}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabel}>
                      <Sheet size={15} color={Colors.light.textSecondary} />
                      <Text style={styles.inputLabelText}>Google Sheets Web App URL</Text>
                    </View>
                    <Text style={styles.inputHint}>
                      Paste your Google Apps Script web app URL to export sales directly
                    </Text>
                    <TextInput
                      style={styles.input}
                      placeholder="https://script.google.com/macros/s/..."
                      placeholderTextColor={Colors.light.textSecondary}
                      value={googleSheetsUrl}
                      onChangeText={setGoogleSheetsUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                    />
                    <TouchableOpacity
                      style={styles.helpBtn}
                      onPress={() => setShowScriptHelp(true)}
                    >
                      <HelpCircle size={13} color={Colors.light.tint} />
                      <Text style={styles.helpBtnText}>How to set up Google Sheets integration</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputGroup, { marginBottom: 0 }]}>
                    <View style={styles.inputLabel}>
                      <Lock size={15} color={Colors.light.textSecondary} />
                      <Text style={styles.inputLabelText}>Admin Password</Text>
                      {isPasswordLocked && (
                        <View style={styles.lockedBadge}>
                          <Lock size={11} color={Colors.light.warning} />
                          <Text style={styles.lockedBadgeText}>Locked</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.inputHint}>
                      {isPasswordLocked
                        ? 'Password is locked. Tap to change.'
                        : 'Used to unlock locked sales. Once set, it will be locked.'}
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
                        onFocus={() => {
                          if (isPasswordLocked && !isEditingPassword) {
                            setPasswordInput('');
                            setShowPasswordPrompt(true);
                          }
                        }}
                      />
                      {(!isPasswordLocked || isEditingPassword) && (
                        <TouchableOpacity
                          style={styles.passwordToggle}
                          onPress={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff size={18} color={Colors.light.textSecondary} />
                          ) : (
                            <Eye size={18} color={Colors.light.textSecondary} />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                    {isPasswordLocked && (
                      <TouchableOpacity style={styles.helpBtn} onPress={handleResetPasswordByEmail}>
                        <RefreshCw size={13} color={Colors.light.tint} />
                        <Text style={styles.helpBtnText}>Forgot password? Reset via email</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setShowUserMgmt(!showUserMgmt)}
              >
                <Text style={styles.sectionTitle}>User Management</Text>
                {showUserMgmt ? (
                  <ChevronUp size={18} color={Colors.light.textSecondary} />
                ) : (
                  <ChevronDown size={18} color={Colors.light.textSecondary} />
                )}
              </TouchableOpacity>

              {showUserMgmt && (
                <View style={styles.card}>
                  {users.map((user) => (
                    <View key={user.id} style={styles.userRow}>
                      <View style={[styles.userAvatar, { backgroundColor: user.avatarColor }]}>
                        {user.profilePicture ? (
                          <Image source={{ uri: user.profilePicture }} style={styles.userAvatarImage} />
                        ) : (
                          <Text style={styles.userAvatarText}>{getInitials(user.name)}</Text>
                        )}
                      </View>
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{user.name}</Text>
                        {user.email ? (
                          <Text style={styles.userEmail}>{user.email}</Text>
                        ) : null}
                      </View>
                      <View
                        style={[
                          styles.roleBadge,
                          user.role === 'org_admin' ? styles.roleBadgeAdmin : styles.roleBadgeUser,
                        ]}
                      >
                        <Text
                          style={[
                            styles.roleBadgeText,
                            user.role === 'org_admin'
                              ? styles.roleBadgeTextAdmin
                              : styles.roleBadgeTextUser,
                          ]}
                        >
                          {user.role === 'org_admin' ? 'Admin' : 'User'}
                        </Text>
                      </View>
                      {user.role !== 'org_admin' && (
                        <TouchableOpacity
                          style={styles.deleteUserBtn}
                          onPress={() => handleDeleteUser(user)}
                        >
                          <Trash2 size={16} color={Colors.light.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}

                  {showNewUserForm ? (
                    <View style={styles.newUserForm}>
                      <TextInput
                        style={styles.input}
                        placeholder="Name *"
                        placeholderTextColor={Colors.light.textSecondary}
                        value={newUserName}
                        onChangeText={setNewUserName}
                        autoFocus
                      />
                      <TextInput
                        style={[styles.input, { marginTop: 8 }]}
                        placeholder="Email (optional)"
                        placeholderTextColor={Colors.light.textSecondary}
                        value={newUserEmail}
                        onChangeText={setNewUserEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                      <View style={styles.rolePickerRow}>
                        <Text style={styles.rolePickerLabel}>Role:</Text>
                        <TouchableOpacity
                          style={[
                            styles.rolePickerBtn,
                            newUserRole === 'user' && styles.rolePickerBtnActive,
                          ]}
                          onPress={() => setNewUserRole('user')}
                        >
                          <Text
                            style={[
                              styles.rolePickerBtnText,
                              newUserRole === 'user' && styles.rolePickerBtnTextActive,
                            ]}
                          >
                            User
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.rolePickerBtn,
                            newUserRole === 'org_admin' && styles.rolePickerBtnActive,
                          ]}
                          onPress={() => setNewUserRole('org_admin')}
                        >
                          <Text
                            style={[
                              styles.rolePickerBtnText,
                              newUserRole === 'org_admin' && styles.rolePickerBtnTextActive,
                            ]}
                          >
                            Admin
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.newUserFormActions}>
                        <TouchableOpacity
                          style={styles.newUserCancelBtn}
                          onPress={() => {
                            setShowNewUserForm(false);
                            setNewUserName('');
                            setNewUserEmail('');
                            setNewUserRole('user');
                          }}
                        >
                          <Text style={styles.newUserCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.newUserConfirmBtn} onPress={handleCreateUser}>
                          <Check size={16} color="#fff" />
                          <Text style={styles.newUserConfirmText}>Add User</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.addUserBtn}
                      onPress={() => setShowNewUserForm(true)}
                    >
                      <Plus size={16} color={Colors.light.tint} />
                      <Text style={styles.addUserBtnText}>Add New User</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reports & Export</Text>
          <TouchableOpacity style={styles.reportCard} onPress={() => router.push('/reports')}>
            <View style={styles.reportCardLeft}>
              <View style={styles.reportIcon}>
                <BarChart3 size={20} color={Colors.light.tint} />
              </View>
              <View>
                <Text style={styles.reportTitle}>View Reports</Text>
                <Text style={styles.reportDesc}>Filter and export quotes & sales data</Text>
              </View>
            </View>
            <View style={styles.reportChevron}>
              <Text style={styles.reportChevronText}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {showScriptHelp && (
        <View style={styles.overlay}>
          <View style={styles.scriptHelpCard}>
            <View style={styles.scriptHelpHeader}>
              <Text style={styles.scriptHelpTitle}>Google Sheets Setup</Text>
              <TouchableOpacity onPress={() => setShowScriptHelp(false)}>
                <ExternalLink size={20} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.scriptHelpContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.scriptHelpStep}>Step 1: Create a new Google Sheet</Text>
              <Text style={styles.scriptHelpText}>
                Open Google Sheets and create a new blank spreadsheet.
              </Text>

              <Text style={styles.scriptHelpStep}>Step 2: Open Apps Script</Text>
              <Text style={styles.scriptHelpText}>Go to Extensions → Apps Script</Text>

              <Text style={styles.scriptHelpStep}>Step 3: Paste the script</Text>
              <Text style={styles.scriptHelpText}>
                Delete any existing code and paste the script below.
              </Text>

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
                  <Copy size={15} color="#fff" />
                  <Text style={styles.copyScriptBtnText}>Copy Full Script</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.scriptHelpStep}>Step 4: Deploy as Web App</Text>
              <Text style={styles.scriptHelpText}>
                {
                  '1. Click "Deploy" → "New deployment"\n2. Select "Web app" as type\n3. Set "Execute as" to "Me"\n4. Set "Who has access" to "Anyone"\n5. Click "Deploy" and authorize'
                }
              </Text>

              <Text style={styles.scriptHelpStep}>Step 5: Copy the Web App URL</Text>
              <Text style={styles.scriptHelpText}>
                Copy the URL that starts with https://script.google.com/macros/s/... and paste it above.
              </Text>

              <View style={styles.scriptHelpNote}>
                <Text style={styles.scriptHelpNoteText}>
                  Note: Use the Web App URL, not the regular Google Sheets URL.
                </Text>
              </View>
            </ScrollView>
            <TouchableOpacity style={styles.scriptHelpCloseBtn} onPress={() => setShowScriptHelp(false)}>
              <Text style={styles.scriptHelpCloseBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showPasswordPrompt && (
        <View style={styles.overlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Enter Admin Password</Text>
            <Text style={styles.promptDesc}>Enter your current password to change it</Text>
            <TextInput
              style={styles.promptInput}
              placeholder="Admin password"
              placeholderTextColor={Colors.light.textSecondary}
              value={passwordInput}
              onChangeText={setPasswordInput}
              secureTextEntry
              autoFocus
            />
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={styles.promptCancelBtn}
                onPress={() => {
                  setShowPasswordPrompt(false);
                  setPasswordInput('');
                }}
              >
                <Text style={styles.promptCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.promptConfirmBtn} onPress={handlePasswordVerification}>
                <Text style={styles.promptConfirmText}>Verify</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.forgotPasswordBtn} onPress={handleResetPasswordByEmail}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      <CropModal
        visible={cropModal.visible}
        imageUri={cropModal.uri}
        aspect={cropModal.aspect}
        title={cropModal.title}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  photoPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  photoPicturePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoInitials: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#fff',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    padding: 4,
  },
  photoActions: {
    flex: 1,
    gap: 6,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.light.highlightBg,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  photoBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  photoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  photoRemoveBtnText: {
    fontSize: 13,
    color: Colors.light.error,
  },
  colorDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.light.text,
    marginBottom: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 5,
  },
  inputLabelText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  saveButton: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  orgHeaderText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.tint,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  logoPreview: {
    width: 120,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  logoPlaceholder: {
    width: 120,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  logoPlaceholderText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  logoActions: {
    flex: 1,
    gap: 6,
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
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
  },
  passwordToggle: {
    padding: 10,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.light.warningBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 6,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.light.warning,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  helpBtnText: {
    fontSize: 12,
    color: Colors.light.tint,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  userAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userAvatarText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  roleBadgeAdmin: {
    backgroundColor: Colors.light.highlightBg,
  },
  roleBadgeUser: {
    backgroundColor: Colors.light.border,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  roleBadgeTextAdmin: {
    color: Colors.light.tint,
  },
  roleBadgeTextUser: {
    color: Colors.light.textSecondary,
  },
  deleteUserBtn: {
    padding: 8,
  },
  newUserForm: {
    marginTop: 12,
    gap: 0,
  },
  rolePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  rolePickerLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  rolePickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  rolePickerBtnActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  rolePickerBtnText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  rolePickerBtnTextActive: {
    color: '#fff',
    fontWeight: '600' as const,
  },
  newUserFormActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  newUserCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  newUserCancelText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500' as const,
  },
  newUserConfirmBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  newUserConfirmText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600' as const,
  },
  addUserBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  addUserBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.tint,
  },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  reportCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.light.highlightBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.light.text,
  },
  reportDesc: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  reportChevron: {
    justifyContent: 'center',
  },
  reportChevronText: {
    fontSize: 22,
    color: Colors.light.textSecondary,
  },
  bottomPadding: {
    height: 40,
  },
  overlay: {
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
  promptCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 22,
    width: '100%',
    maxWidth: 340,
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  promptDesc: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 16,
    textAlign: 'center',
  },
  promptInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.light.text,
    backgroundColor: Colors.light.background,
    marginBottom: 16,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 10,
  },
  promptCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  promptCancelText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.light.textSecondary,
  },
  promptConfirmBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: Colors.light.tint,
    alignItems: 'center',
  },
  promptConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#fff',
  },
  forgotPasswordBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  forgotPasswordText: {
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
    marginBottom: 14,
  },
  scriptHelpTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.light.text,
  },
  scriptHelpContent: {
    maxHeight: 400,
  },
  scriptHelpStep: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.light.tint,
    marginTop: 14,
    marginBottom: 4,
  },
  scriptHelpText: {
    fontSize: 13,
    color: Colors.light.text,
    lineHeight: 20,
  },
  scriptCodeBox: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  scriptCodeText: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d4',
    lineHeight: 15,
  },
  copyScriptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.light.tint,
    paddingVertical: 9,
    borderRadius: 6,
    marginTop: 8,
  },
  copyScriptBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#fff',
  },
  scriptHelpNote: {
    backgroundColor: Colors.light.warningBg,
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  scriptHelpNoteText: {
    fontSize: 12,
    color: Colors.light.warning,
    fontWeight: '500' as const,
  },
  scriptHelpCloseBtn: {
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  scriptHelpCloseBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
