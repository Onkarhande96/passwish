import os
import sys
import json
import base64
import datetime
import argparse

import license_manager
from license_manager import MASTER_SALT, create_license_signature

def generate_key(client_name, machine_id, expiry_str):
    """
    Generates a cryptographically signed hardware-locked license key.
    """
    client_name = client_name.strip()
    machine_id = machine_id.strip().upper()

    payload_dict = {
        "client_name": client_name,
        "machine_id": machine_id,
        "expiry": expiry_str,
        "issued_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    payload_json = json.dumps(payload_dict, separators=(',', ':'))
    payload_bytes = payload_json.encode('utf-8')
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode('utf-8')

    signature = create_license_signature(payload_bytes)
    return f"LIC-{payload_b64}.{signature}"

def interactive_cli():
    print("=" * 65)
    print("       PassWish — Vendor Commercial License Key Generator")
    print("=" * 65)
    print("Use this tool to generate locked activation keys for your clients.\n")

    client_name = input("Enter Client / Shop Name (e.g. Shree Travels): ").strip()
    if not client_name:
        client_name = "Valued Client"

    machine_id = input("Enter Client's Machine ID (e.g. PW-XXXX-XXXX-XXXX-XXXX): ").strip().upper()
    if not machine_id:
        print("\n[!] Error: Machine ID is required!")
        return

    print("\nSelect License Validity Period:")
    print("1. 1 Year (365 Days)")
    print("2. 2 Years (730 Days)")
    print("3. Lifetime (No Expiry)")
    print("4. Custom Days")
    choice = input("Enter choice (1, 2, 3, or 4) [default: 1]: ").strip()

    today = datetime.date.today()
    if choice == '2':
        expiry_date = today + datetime.timedelta(days=730)
        expiry_str = expiry_date.strftime("%Y-%m-%d")
        validity_desc = f"2 Years (Expires {expiry_str})"
    elif choice == '3':
        expiry_str = "LIFETIME"
        validity_desc = "Lifetime (Permanent, No Expiration)"
    elif choice == '4':
        days_input = input("Enter number of validity days (e.g. 180): ").strip()
        days = int(days_input) if days_input.isdigit() else 365
        expiry_date = today + datetime.timedelta(days=days)
        expiry_str = expiry_date.strftime("%Y-%m-%d")
        validity_desc = f"{days} Days (Expires {expiry_str})"
    else: # Default 1 year
        expiry_date = today + datetime.timedelta(days=365)
        expiry_str = expiry_date.strftime("%Y-%m-%d")
        validity_desc = f"1 Year (Expires {expiry_str})"

    license_key = generate_key(client_name, machine_id, expiry_str)

    # Automatically save to Customer_Licenses_Register.xlsx
    try:
        from license_generator_gui import log_license_to_excel
        log_license_to_excel(client_name, machine_id, validity_desc, expiry_str, license_key)
        saved_notice = "✓ Saved to Customer_Licenses_Register.xlsx"
    except Exception:
        saved_notice = ""

    print("\n" + "=" * 65)
    print("✓ LICENSE KEY GENERATED SUCCESSFULLY!")
    if saved_notice:
        print(f"  {saved_notice}")
    print("=" * 65)
    print(f"Client Name : {client_name}")
    print(f"Machine ID  : {machine_id}")
    print(f"Validity    : {validity_desc}")
    print("-" * 65)
    print("COPY THE LICENSE KEY BELOW AND SEND IT TO YOUR CUSTOMER:")
    print("-" * 65)
    print(f"\n{license_key}\n")
    print("=" * 65)
    print("Instructions for Customer:")
    print("1. Open PassWish on the computer.")
    print("2. Paste this License Key into the Activation Box.")
    print("3. Click 'Activate PassWish'.")
    print("=" * 65)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="PassWish License Key Generator")
    parser.add_argument("--name", help="Client name")
    parser.add_argument("--machine", help="Customer Machine ID")
    parser.add_argument("--days", type=int, help="Validity in days (0 for lifetime)")
    args = parser.parse_args()

    if args.name and args.machine:
        if args.days == 0:
            exp_str = "LIFETIME"
        else:
            days = args.days if args.days else 365
            exp_str = (datetime.date.today() + datetime.timedelta(days=days)).strftime("%Y-%m-%d")
        key = generate_key(args.name, args.machine, exp_str)
        print(key)
    else:
        interactive_cli()
