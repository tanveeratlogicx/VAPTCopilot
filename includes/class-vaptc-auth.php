<?php

/**
 * Superadmin OTP Authentication for VAPT Master
 */

if (! defined('ABSPATH')) {
  exit;
}

class VAPTC_Auth
{
  public function __construct()
  {
    add_action('admin_init', array($this, 'handle_otp_verification'));
  }

  /**
   * Check if the current user is authenticated
   */
  public static function is_authenticated()
  {
    $user_id = get_current_user_id();
    if (!$user_id) {
      return false;
    }

    $session = get_transient('vaptc_auth_' . $user_id);
    if (!$session) {
      return false;
    }

    return true;
  }

  /**
   * Send OTP to the superadmin email
   */
  public static function send_otp()
  {
    $otp = wp_generate_password(6, false, false);
    $hashed_otp = wp_hash_password($otp);

    // Store OTP in transient for 10 minutes
    // Email Only per user request
    set_transient('vaptc_otp_email_' . VAPTC_SUPERADMIN_USER, $hashed_otp, 10 * MINUTE_IN_SECONDS);

    // 1. Send Email
    $message = sprintf(
      __('Your VAPT Copilot verification code is: %s. This code will expire in 10 minutes.', 'vapt-Copilot'),
      $otp
    );
    wp_mail(VAPTC_SUPERADMIN_EMAIL, __('VAPT Copilot - Verification Code', 'vapt-Copilot'), $message);
  }

  /**
   * Handle OTP verification from the form
   */
  public function handle_otp_verification()
  {
    if (! isset($_POST['vaptc_otp_nonce']) || ! wp_verify_nonce($_POST['vaptc_otp_nonce'], 'vaptc_verify_otp')) {
      return;
    }

    if (! isset($_POST['vaptc_email_otp'])) {
      return;
    }

    $submitted_otp = sanitize_text_field($_POST['vaptc_email_otp']);
    $stored_otp = get_transient('vaptc_otp_email_' . VAPTC_SUPERADMIN_USER);

    if ($stored_otp && wp_check_password($submitted_otp, $stored_otp)) {
      // Successful verification
      $user_id = get_current_user_id();
      set_transient('vaptc_auth_' . $user_id, array(
        'user' => VAPTC_SUPERADMIN_USER,
        'time' => time()
      ), 2 * HOUR_IN_SECONDS);

      delete_transient('vaptc_otp_email_' . VAPTC_SUPERADMIN_USER);

      wp_safe_redirect(admin_url('admin.php?page=vapt-domain-admin'));
      exit;
    }
  }

  /**
   * Render the OTP verification form
   */
  public static function render_otp_form()
  {
    if (isset($_GET['resend_otp'])) {
      self::send_otp();
    }
?>
    <style>
      .vaptc-otp-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
      }

      .vaptc-otp-box {
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
        width: 100%;
        max-width: 400px;
        text-align: center;
        border: 1px solid rgba(255, 255, 255, 0.1);
        position: relative;
      }

      .vaptc-otp-box h2 {
        margin: 0 0 10px;
        font-size: 24px;
        font-weight: 600;
        color: #fff;
      }

      .vaptc-otp-box p {
        margin-bottom: 30px;
        color: rgba(255, 255, 255, 0.7);
        line-height: 1.5;
      }

      .vaptc-otp-input {
        width: 100%;
        padding: 15px;
        border-radius: 8px;
        border: none;
        background: rgba(255, 255, 255, 0.9);
        font-size: 20px;
        text-align: center;
        letter-spacing: 5px;
        margin-bottom: 20px;
        color: #1a237e;
        font-weight: bold;
      }

      .vaptc-otp-submit {
        width: 100%;
        padding: 15px;
        border-radius: 8px;
        border: none;
        background: #00e676;
        color: #1a237e;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.2s, background 0.2s;
      }

      .vaptc-otp-submit:hover {
        background: #00c853;
        transform: translateY(-2px);
      }

      .vaptc-otp-error {
        margin-top: 15px;
        color: #ff5252;
        font-weight: 500;
        background: rgba(255, 0, 0, 0.1);
        padding: 10px;
        border-radius: 4px;
      }

      .vaptc-resend {
        margin-top: 20px;
        display: block;
        color: rgba(255, 255, 255, 0.6);
        text-decoration: none;
        font-size: 14px;
      }

      .vaptc-resend:hover {
        color: #fff;
      }
    </style>
    <div class="vaptc-otp-overlay">
      <div class="vaptc-otp-box">
        <div style="font-size: 40px; margin-bottom: 20px;">🛡️</div>
        <h2><?php _e('Identity Verification', 'vapt-Copilot'); ?></h2>
        <p><?php _e('Enter the 6-digit code sent to your Email.', 'vapt-Copilot'); ?></p>
        <form method="POST" action="">
          <?php wp_nonce_field('vaptc_verify_otp', 'vaptc_otp_nonce'); ?>
          <input type="text" name="vaptc_email_otp" class="vaptc-otp-input" placeholder="000000" maxlength="6" autofocus required autocomplete="one-time-code" />
          <button type="submit" name="vaptc_otp_submit" class="vaptc-otp-submit"><?php _e('Verify & Access', 'vapt-Copilot'); ?></button>
        </form>
        <?php
        if (isset($_POST['vaptc_otp_submit'])) {
          echo '<div class="vaptc-otp-error">' . __('Invalid or expired code. Please try again.', 'vapt-Copilot') . '</div>';
        }
        if (isset($_GET['resend_otp'])) {
          echo '<div style="margin-top:10px; color:#00e676;">' . __('A new code has been sent!', 'vapt-Copilot') . '</div>';
        }
        ?>
        <a href="<?php echo esc_url(add_query_arg('resend_otp', '1')); ?>" class="vaptc-resend"><?php _e('Didn\'t receive the code? Resend', 'vapt-Copilot'); ?></a>
      </div>
    </div>
<?php
  }
}
