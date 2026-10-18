package com.sagittaryuz.calendartimeline;

import android.accounts.*;
import android.app.*;
import android.content.*;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.Scope;
import com.microsoft.identity.client.*;
import com.microsoft.identity.client.exception.MsalException;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.json.*;

/**
 * Official GIS / MSAL consent. Unconfigured builds never initialize a login or create credentials.
 */
final class TaskAuth {
  static final String GOOGLE_READ = "https://www.googleapis.com/auth/tasks.readonly",
      GOOGLE_WRITE = "https://www.googleapis.com/auth/tasks";
  static final String REDIRECT =
      "msauth://com.sagittaryuz.calendartimeline/nZa0l%2B1MIBcU9O25MRlmaceZNOo%3D";
  static final int ACCOUNT_PICKER = 81, GOOGLE_CONSENT = 82;

  static final class Session {
    final String provider, account, label, token;
    final boolean writable;
    final long expires;

    Session(
        String provider,
        String account,
        String label,
        String token,
        boolean writable,
        long expires) {
      this.provider = provider;
      this.account = account;
      this.label = label;
      this.token = token;
      this.writable = writable;
      this.expires = expires;
    }
  }

  interface Result {
    void success(Session session);

    void failure(String message);
  }

  static final Map<String, Session> MEMORY = new ConcurrentHashMap<>();

  static Session session(String provider, String account) {
    Session s = MEMORY.get(ExternalTaskStore.accountKey(provider, account));
    return s != null && s.expires > System.currentTimeMillis() + 60000 ? s : null;
  }

  static void remember(Session s) {
    MEMORY.put(ExternalTaskStore.accountKey(s.provider, s.account), s);
  }

  static void forget(String provider, String account) {
    MEMORY.remove(ExternalTaskStore.accountKey(provider, account));
  }

  static boolean graphScope(String[] granted, String scope) {
    if (granted == null) return false;
    for (String value : granted)
      if (scope.equalsIgnoreCase(value)
          || ("https://graph.microsoft.com/" + scope).equalsIgnoreCase(value)) return true;
    return false;
  }

  final Activity activity;
  Result result;
  boolean write;
  String googleAccount = "";

  TaskAuth(Activity activity) {
    this.activity = activity;
  }

  boolean configured(String provider) {
    return provider.equals("google")
        ? BuildConfig.GOOGLE_TASKS_CONFIGURED
        : !BuildConfig.MICROSOFT_CLIENT_ID.isEmpty();
  }

  void connect(String provider, boolean writable, Result callback) {
    if (!configured(provider)) {
      callback.failure("Configuração do aplicativo pendente; nenhuma conta foi conectada");
      return;
    }
    if (result != null) {
      callback.failure("Conclua a autorização já aberta");
      return;
    }
    result = callback;
    write = writable;
    if (provider.equals("google")) {
      try {
        activity.startActivityForResult(
            AccountManager.newChooseAccountIntent(
                null, null, new String[] {"com.google"}, null, null, null, null),
            ACCOUNT_PICKER);
      } catch (Exception e) {
        fail("Seletor Google indisponível neste aparelho");
      }
    } else microsoft();
  }

  void deliver(Session session) {
    Result callback = result;
    result = null;
    if (session.token == null || session.token.isEmpty()) {
      if (callback != null) callback.failure("A origem não concedeu acesso às tarefas");
      return;
    }
    remember(session);
    if (callback != null) callback.success(session);
  }

  void fail(String text) {
    Result callback = result;
    result = null;
    if (callback != null) callback.failure(text);
  }

  void google() {
    AuthorizationRequest request =
        AuthorizationRequest.builder()
            .setAccount(new android.accounts.Account(googleAccount, "com.google"))
            .setRequestedScopes(
                Collections.singletonList(new Scope(write ? GOOGLE_WRITE : GOOGLE_READ)))
            .setOptOutIncludingGrantedScopes(true)
            .build();
    Identity.getAuthorizationClient(activity)
        .authorize(request)
        .addOnSuccessListener(
            value -> {
              if (value.hasResolution()) {
                try {
                  activity.startIntentSenderForResult(
                      value.getPendingIntent().getIntentSender(), GOOGLE_CONSENT, null, 0, 0, 0);
                } catch (Exception e) {
                  fail("Não foi possível abrir o consentimento Google");
                }
              } else googleResult(value);
            })
        .addOnFailureListener(
            e -> fail("Google indisponível ou autorização recusada; a conta não foi conectada"));
  }

  void googleResult(AuthorizationResult value) {
    List<String> granted = value.getGrantedScopes();
    if (!granted.contains(write ? GOOGLE_WRITE : GOOGLE_READ) && !granted.contains(GOOGLE_WRITE)) {
      fail("Permissão de tarefas não concedida");
      return;
    }
    deliver(
        new Session(
            "google",
            googleAccount,
            googleAccount,
            value.getAccessToken(),
            granted.contains(GOOGLE_WRITE),
            System.currentTimeMillis() + 45 * 60000));
  }

  void onActivityResult(int request, int code, Intent data) {
    if (request != ACCOUNT_PICKER && request != GOOGLE_CONSENT) return;
    if (result == null) return;
    if (code != Activity.RESULT_OK || data == null) {
      fail("Conexão cancelada; nenhuma nova fonte ativada");
      return;
    }
    try {
      if (request == ACCOUNT_PICKER) {
        googleAccount = data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
        if (googleAccount == null || googleAccount.isEmpty()) {
          fail("Conta Google não selecionada");
          return;
        }
        google();
      } else
        googleResult(
            Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data));
    } catch (Exception e) {
      fail("Consentimento Google inválido ou cancelado");
    }
  }

  interface MicrosoftReady {
    void ready(IMultipleAccountPublicClientApplication app);

    void error();
  }

  void microsoftApp(MicrosoftReady callback) {
    if (BuildConfig.MICROSOFT_CLIENT_ID.isEmpty()) {
      callback.error();
      return;
    }
    try {
      JSONObject config =
          new JSONObject()
              .put("client_id", BuildConfig.MICROSOFT_CLIENT_ID)
              .put("redirect_uri", REDIRECT)
              .put("account_mode", "MULTIPLE")
              .put("authorization_user_agent", "BROWSER")
              .put("broker_redirect_uri_registered", false)
              .put(
                  "logging",
                  new JSONObject().put("pii_enabled", false).put("logcat_enabled", false));
      File file = new File(activity.getFilesDir(), "msal-public-configuration.json");
      try (FileOutputStream out = new FileOutputStream(file)) {
        out.write(config.toString().getBytes(StandardCharsets.UTF_8));
      }
      PublicClientApplication.createMultipleAccountPublicClientApplication(
          activity,
          file,
          new IPublicClientApplication.IMultipleAccountApplicationCreatedListener() {
            public void onCreated(IMultipleAccountPublicClientApplication app) {
              callback.ready(app);
            }

            public void onError(MsalException e) {
              callback.error();
            }
          });
    } catch (Exception e) {
      callback.error();
    }
  }

  void microsoft() {
    microsoftApp(
        new MicrosoftReady() {
          public void error() {
            fail("Configuração Microsoft indisponível; nenhuma conta conectada");
          }

          public void ready(IMultipleAccountPublicClientApplication app) {
            app.acquireToken(
                new AcquireTokenParameters.Builder()
                    .startAuthorizationFromActivity(activity)
                    .withScopes(Collections.singletonList(write ? "Tasks.ReadWrite" : "Tasks.Read"))
                    .withPrompt(Prompt.SELECT_ACCOUNT)
                    .withCallback(
                        new AuthenticationCallback() {
                          public void onSuccess(IAuthenticationResult value) {
                            boolean canWrite = graphScope(value.getScope(), "Tasks.ReadWrite");
                            if ((!canWrite && !graphScope(value.getScope(), "Tasks.Read"))
                                || (write && !canWrite)) {
                              fail("Permissão de tarefas solicitada não foi concedida");
                              return;
                            }
                            String id = value.getAccount().getId();
                            deliver(
                                new Session(
                                    "microsoft",
                                    id,
                                    value.getAccount().getUsername(),
                                    value.getAccessToken(),
                                    write && canWrite,
                                    value.getExpiresOn().getTime()));
                          }

                          public void onError(MsalException e) {
                            fail("Microsoft indisponível ou autorização recusada");
                          }

                          public void onCancel() {
                            fail("Conexão Microsoft cancelada");
                          }
                        })
                    .build());
          }
        });
  }

  void disconnect(String provider, String account, Runnable done) {
    forget(provider, account);
    if (provider.equals("google") && configured(provider)) {
      Identity.getAuthorizationClient(activity)
          .revokeAccess(
              RevokeAccessRequest.builder()
                  .setAccount(new android.accounts.Account(account, "com.google"))
                  .setScopes(Collections.singletonList(new Scope(GOOGLE_READ)))
                  .build())
          .addOnCompleteListener(task -> done.run());
    } else if (provider.equals("microsoft") && configured(provider)) {
      microsoftApp(
          new MicrosoftReady() {
            public void error() {
              done.run();
            }

            public void ready(IMultipleAccountPublicClientApplication app) {
              app.getAccount(
                  account,
                  new IMultipleAccountPublicClientApplication.GetAccountCallback() {
                    public void onError(MsalException e) {
                      done.run();
                    }

                    public void onTaskCompleted(IAccount value) {
                      if (value == null) {
                        done.run();
                        return;
                      }
                      app.removeAccount(
                          value,
                          new IMultipleAccountPublicClientApplication.RemoveAccountCallback() {
                            public void onRemoved() {
                              done.run();
                            }

                            public void onError(MsalException e) {
                              done.run();
                            }
                          });
                    }
                  });
            }
          });
    } else done.run();
  }
}
