package com.mtech.msign

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Relaunch MSIGN when the device powers on, so a stick plugged into a TV starts
 * playing without anyone touching a remote. Some newer Android versions restrict
 * background activity starts; on those the user opens the app once from the launcher.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON") return
        val launch = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { context.startActivity(launch) }
    }
}
