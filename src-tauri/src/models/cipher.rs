//! Cipher models (Login, Secure Note, Card, Identity, and Custom Fields)
//! in both encrypted Bitwarden wire format and decrypted frontend DTO format.

use serde::{Deserialize, Serialize};

use crate::crypto::{
    enc_string::{decrypt_optional, encrypt_optional, EncString},
    keys::SymmetricCryptoKey,
};
use crate::error::AppError;

/// Bitwarden cipher item type (`1` = Login, `2` = Secure Note, `3` = Card, `4` = Identity).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum CipherType {
    Login = 1,
    SecureNote = 2,
    Card = 3,
    Identity = 4,
}

/// Encrypted URI entry inside a Login cipher.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedLoginUri {
    #[serde(alias = "Uri")]
    pub uri: Option<String>,
    #[serde(alias = "Match")]
    pub r#match: Option<u8>,
}

/// Encrypted Login data inside an [`EncryptedCipher`].
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedLogin {
    #[serde(alias = "Username")]
    pub username: Option<String>,
    #[serde(alias = "Password")]
    pub password: Option<String>,
    #[serde(alias = "Totp")]
    pub totp: Option<String>,
    #[serde(alias = "Uris", default)]
    pub uris: Option<Vec<EncryptedLoginUri>>,
}

/// Encrypted Secure Note data inside an [`EncryptedCipher`].
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedSecureNote {
    #[serde(alias = "Type", default)]
    pub r#type: u8,
}

/// Encrypted Card data inside an [`EncryptedCipher`].
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedCard {
    #[serde(alias = "CardholderName")]
    pub cardholder_name: Option<String>,
    #[serde(alias = "Brand")]
    pub brand: Option<String>,
    #[serde(alias = "Number")]
    pub number: Option<String>,
    #[serde(alias = "ExpMonth")]
    pub exp_month: Option<String>,
    #[serde(alias = "ExpYear")]
    pub exp_year: Option<String>,
    #[serde(alias = "Code")]
    pub code: Option<String>,
}

/// Encrypted Identity data inside an [`EncryptedCipher`].
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedIdentity {
    #[serde(alias = "Title")]
    pub title: Option<String>,
    #[serde(alias = "FirstName")]
    pub first_name: Option<String>,
    #[serde(alias = "MiddleName")]
    pub middle_name: Option<String>,
    #[serde(alias = "LastName")]
    pub last_name: Option<String>,
    #[serde(alias = "Username")]
    pub username: Option<String>,
    #[serde(alias = "Company")]
    pub company: Option<String>,
    #[serde(alias = "Email")]
    pub email: Option<String>,
    #[serde(alias = "Phone")]
    pub phone: Option<String>,
    #[serde(alias = "Ssn")]
    pub ssn: Option<String>,
    #[serde(alias = "PassportNumber")]
    pub passport_number: Option<String>,
    #[serde(alias = "LicenseNumber")]
    pub license_number: Option<String>,
    #[serde(alias = "Address1")]
    pub address1: Option<String>,
    #[serde(alias = "Address2")]
    pub address2: Option<String>,
    #[serde(alias = "City")]
    pub city: Option<String>,
    #[serde(alias = "State")]
    pub state: Option<String>,
    #[serde(alias = "PostalCode")]
    pub postal_code: Option<String>,
    #[serde(alias = "Country")]
    pub country: Option<String>,
}

/// Encrypted custom field entry.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedCustomField {
    #[serde(alias = "Name")]
    pub name: Option<String>,
    #[serde(alias = "Value")]
    pub value: Option<String>,
    #[serde(alias = "Type", default)]
    pub r#type: u8,
}

/// Encrypted cipher payload returned by `/api/sync` or `/api/ciphers`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EncryptedCipher {
    #[serde(alias = "Id")]
    pub id: Option<String>,
    #[serde(alias = "OrganizationId")]
    pub organization_id: Option<String>,
    #[serde(alias = "FolderId")]
    pub folder_id: Option<String>,
    #[serde(alias = "Type", default)]
    pub r#type: u8,
    #[serde(alias = "Name")]
    pub name: Option<String>,
    #[serde(alias = "Notes")]
    pub notes: Option<String>,
    #[serde(alias = "Favorite", default)]
    pub favorite: bool,
    #[serde(alias = "Login")]
    pub login: Option<EncryptedLogin>,
    #[serde(alias = "SecureNote")]
    pub secure_note: Option<EncryptedSecureNote>,
    #[serde(alias = "Card")]
    pub card: Option<EncryptedCard>,
    #[serde(alias = "Identity")]
    pub identity: Option<EncryptedIdentity>,
    #[serde(alias = "Fields", default)]
    pub fields: Option<Vec<EncryptedCustomField>>,
    #[serde(alias = "RevisionDate")]
    pub revision_date: Option<String>,
    #[serde(alias = "CreationDate")]
    pub creation_date: Option<String>,
    #[serde(alias = "DeletedDate")]
    pub deleted_date: Option<String>,
    #[serde(alias = "Reprompt", default)]
    pub reprompt: u8,
}

// ============================================================================
// Decrypted UI DTOs
// ============================================================================

/// Decrypted Login URI view.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginUriView {
    pub uri: String,
    pub r#match: Option<u8>,
}

/// Decrypted Login view.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginView {
    pub username: Option<String>,
    pub password: Option<String>,
    pub totp: Option<String>,
    pub uris: Vec<LoginUriView>,
}

/// Decrypted Card view.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardView {
    pub cardholder_name: Option<String>,
    pub brand: Option<String>,
    pub number: Option<String>,
    pub exp_month: Option<String>,
    pub exp_year: Option<String>,
    pub code: Option<String>,
}

/// Decrypted Identity view.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdentityView {
    pub title: Option<String>,
    pub first_name: Option<String>,
    pub middle_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub company: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub ssn: Option<String>,
    pub passport_number: Option<String>,
    pub license_number: Option<String>,
    pub address1: Option<String>,
    pub address2: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub postal_code: Option<String>,
    pub country: Option<String>,
}

/// Decrypted custom field (`0` = Text, `1` = Hidden, `2` = Boolean).
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFieldView {
    pub name: String,
    pub value: String,
    pub r#type: u8,
}

/// Decrypted cipher DTO sent to and received from the frontend.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CipherView {
    pub id: String,
    pub organization_id: Option<String>,
    pub folder_id: Option<String>,
    /// `1` = Login, `2` = Secure Note, `3` = Card, `4` = Identity
    pub r#type: u8,
    pub name: String,
    pub notes: Option<String>,
    pub favorite: bool,
    pub login: Option<LoginView>,
    pub card: Option<CardView>,
    pub identity: Option<IdentityView>,
    pub fields: Vec<CustomFieldView>,
    pub revision_date: Option<String>,
    pub creation_date: Option<String>,
    pub deleted_date: Option<String>,
}

impl EncryptedCipher {
    /// Decrypts an [`EncryptedCipher`] using the vault's [`SymmetricCryptoKey`].
    pub fn decrypt(&self, key: &SymmetricCryptoKey) -> Result<CipherView, AppError> {
        let id = self.id.clone().unwrap_or_default();
        let name = decrypt_optional(self.name.as_deref(), key)
            .unwrap_or(None)
            .unwrap_or_else(|| "Untitled Item".to_string());
        let notes = decrypt_optional(self.notes.as_deref(), key).unwrap_or(None);

        let login = match &self.login {
            Some(enc_login) => {
                let username = decrypt_optional(enc_login.username.as_deref(), key).unwrap_or(None);
                let password = decrypt_optional(enc_login.password.as_deref(), key).unwrap_or(None);
                let totp = decrypt_optional(enc_login.totp.as_deref(), key).unwrap_or(None);
                let mut uris = Vec::new();
                if let Some(enc_uris) = &enc_login.uris {
                    for u in enc_uris {
                        if let Ok(Some(decrypted_uri)) = decrypt_optional(u.uri.as_deref(), key) {
                            uris.push(LoginUriView {
                                uri: decrypted_uri,
                                r#match: u.r#match,
                            });
                        }
                    }
                }
                Some(LoginView {
                    username,
                    password,
                    totp,
                    uris,
                })
            }
            None => None,
        };

        let card = self.card.as_ref().map(|enc_card| CardView {
            cardholder_name: decrypt_optional(enc_card.cardholder_name.as_deref(), key)
                .unwrap_or(None),
            brand: decrypt_optional(enc_card.brand.as_deref(), key).unwrap_or(None),
            number: decrypt_optional(enc_card.number.as_deref(), key).unwrap_or(None),
            exp_month: decrypt_optional(enc_card.exp_month.as_deref(), key).unwrap_or(None),
            exp_year: decrypt_optional(enc_card.exp_year.as_deref(), key).unwrap_or(None),
            code: decrypt_optional(enc_card.code.as_deref(), key).unwrap_or(None),
        });

        let identity = self.identity.as_ref().map(|enc_id| IdentityView {
            title: decrypt_optional(enc_id.title.as_deref(), key).unwrap_or(None),
            first_name: decrypt_optional(enc_id.first_name.as_deref(), key).unwrap_or(None),
            middle_name: decrypt_optional(enc_id.middle_name.as_deref(), key).unwrap_or(None),
            last_name: decrypt_optional(enc_id.last_name.as_deref(), key).unwrap_or(None),
            username: decrypt_optional(enc_id.username.as_deref(), key).unwrap_or(None),
            company: decrypt_optional(enc_id.company.as_deref(), key).unwrap_or(None),
            email: decrypt_optional(enc_id.email.as_deref(), key).unwrap_or(None),
            phone: decrypt_optional(enc_id.phone.as_deref(), key).unwrap_or(None),
            ssn: decrypt_optional(enc_id.ssn.as_deref(), key).unwrap_or(None),
            passport_number: decrypt_optional(enc_id.passport_number.as_deref(), key)
                .unwrap_or(None),
            license_number: decrypt_optional(enc_id.license_number.as_deref(), key)
                .unwrap_or(None),
            address1: decrypt_optional(enc_id.address1.as_deref(), key).unwrap_or(None),
            address2: decrypt_optional(enc_id.address2.as_deref(), key).unwrap_or(None),
            city: decrypt_optional(enc_id.city.as_deref(), key).unwrap_or(None),
            state: decrypt_optional(enc_id.state.as_deref(), key).unwrap_or(None),
            postal_code: decrypt_optional(enc_id.postal_code.as_deref(), key).unwrap_or(None),
            country: decrypt_optional(enc_id.country.as_deref(), key).unwrap_or(None),
        });

        let mut fields = Vec::new();
        if let Some(enc_fields) = &self.fields {
            for f in enc_fields {
                let f_name = decrypt_optional(f.name.as_deref(), key)
                    .unwrap_or(None)
                    .unwrap_or_default();
                let f_val = decrypt_optional(f.value.as_deref(), key)
                    .unwrap_or(None)
                    .unwrap_or_default();
                fields.push(CustomFieldView {
                    name: f_name,
                    value: f_val,
                    r#type: f.r#type,
                });
            }
        }

        Ok(CipherView {
            id,
            organization_id: self.organization_id.clone(),
            folder_id: self.folder_id.clone(),
            r#type: self.r#type,
            name,
            notes,
            favorite: self.favorite,
            login,
            card,
            identity,
            fields,
            revision_date: self.revision_date.clone(),
            creation_date: self.creation_date.clone(),
            deleted_date: self.deleted_date.clone(),
        })
    }
}

impl CipherView {
    /// Encrypts a plaintext [`CipherView`] into an [`EncryptedCipher`] ready for
    /// `POST /api/ciphers` or `PUT /api/ciphers/{id}`.
    pub fn encrypt(&self, key: &SymmetricCryptoKey) -> Result<EncryptedCipher, AppError> {
        let encrypted_name = EncString::encrypt_utf8(&self.name, key)?;
        let encrypted_notes = encrypt_optional(self.notes.as_deref(), key)?;

        let login = if self.r#type == 1 {
            let l = self.login.clone().unwrap_or_default();
            let mut enc_uris = Vec::new();
            for u in &l.uris {
                if !u.uri.trim().is_empty() {
                    enc_uris.push(EncryptedLoginUri {
                        uri: Some(EncString::encrypt_utf8(u.uri.trim(), key)?),
                        r#match: u.r#match,
                    });
                }
            }
            Some(EncryptedLogin {
                username: encrypt_optional(l.username.as_deref(), key)?,
                password: encrypt_optional(l.password.as_deref(), key)?,
                totp: encrypt_optional(l.totp.as_deref(), key)?,
                uris: Some(enc_uris),
            })
        } else {
            None
        };

        let secure_note = if self.r#type == 2 {
            Some(EncryptedSecureNote { r#type: 0 })
        } else {
            None
        };

        let card = if self.r#type == 3 {
            let c = self.card.clone().unwrap_or_default();
            Some(EncryptedCard {
                cardholder_name: encrypt_optional(c.cardholder_name.as_deref(), key)?,
                brand: encrypt_optional(c.brand.as_deref(), key)?,
                number: encrypt_optional(c.number.as_deref(), key)?,
                exp_month: encrypt_optional(c.exp_month.as_deref(), key)?,
                exp_year: encrypt_optional(c.exp_year.as_deref(), key)?,
                code: encrypt_optional(c.code.as_deref(), key)?,
            })
        } else {
            None
        };

        let identity = if self.r#type == 4 {
            let id = self.identity.clone().unwrap_or_default();
            Some(EncryptedIdentity {
                title: encrypt_optional(id.title.as_deref(), key)?,
                first_name: encrypt_optional(id.first_name.as_deref(), key)?,
                middle_name: encrypt_optional(id.middle_name.as_deref(), key)?,
                last_name: encrypt_optional(id.last_name.as_deref(), key)?,
                username: encrypt_optional(id.username.as_deref(), key)?,
                company: encrypt_optional(id.company.as_deref(), key)?,
                email: encrypt_optional(id.email.as_deref(), key)?,
                phone: encrypt_optional(id.phone.as_deref(), key)?,
                ssn: encrypt_optional(id.ssn.as_deref(), key)?,
                passport_number: encrypt_optional(id.passport_number.as_deref(), key)?,
                license_number: encrypt_optional(id.license_number.as_deref(), key)?,
                address1: encrypt_optional(id.address1.as_deref(), key)?,
                address2: encrypt_optional(id.address2.as_deref(), key)?,
                city: encrypt_optional(id.city.as_deref(), key)?,
                state: encrypt_optional(id.state.as_deref(), key)?,
                postal_code: encrypt_optional(id.postal_code.as_deref(), key)?,
                country: encrypt_optional(id.country.as_deref(), key)?,
            })
        } else {
            None
        };

        let mut enc_fields = Vec::new();
        for f in &self.fields {
            if !f.name.trim().is_empty() || !f.value.trim().is_empty() {
                enc_fields.push(EncryptedCustomField {
                    name: encrypt_optional(Some(&f.name), key)?,
                    value: encrypt_optional(Some(&f.value), key)?,
                    r#type: f.r#type,
                });
            }
        }

        Ok(EncryptedCipher {
            id: if self.id.is_empty() {
                None
            } else {
                Some(self.id.clone())
            },
            organization_id: self.organization_id.clone(),
            folder_id: self.folder_id.clone().filter(|s| !s.is_empty()),
            r#type: self.r#type,
            name: Some(encrypted_name),
            notes: encrypted_notes,
            favorite: self.favorite,
            login,
            secure_note,
            card,
            identity,
            fields: if enc_fields.is_empty() {
                None
            } else {
                Some(enc_fields)
            },
            revision_date: self.revision_date.clone(),
            creation_date: self.creation_date.clone(),
            deleted_date: self.deleted_date.clone(),
            reprompt: 0,
        })
    }
}
