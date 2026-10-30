using System.Collections.Generic;
using UnityEngine;
using System.Linq;

public class Basics : MonoBehaviour
{
    public List<int> nums = new List<int> { 1, 2, 3 };
    public string[] names = new string[] { "a", "b" };
    public GameObject[] enemies;
    private Dictionary<string, int> scores = new Dictionary<string, int>();
    private int hp = 10;

    void Start()
    {
        Invoke("Spawn", 2f);
        CancelInvoke();
        CancelInvoke("Spawn");
        bool waiting = IsInvoking("Spawn");
        enabled = false;
        Time.timeScale = 0.5f;
        Application.targetFrameRate = 60;
        enemies = GameObject.FindGameObjectsWithTag("Enemy");
        float r = Random.value;
        Vector3 p = Random.insideUnitSphere;
        int first = nums[0];
        int last = nums[nums.Count - 1];
        int pick = nums[Random.Range(0, nums.Count)];
        int len = names.Length;
        nums.RemoveAt(0);
        nums.AddRange(new List<int> { 4, 5 });
        nums.Reverse();
        nums.Sort();
        int total = nums.Sum();
        int max = nums.Max();
        bool any = nums.Any();
        int[] arr = nums.ToArray();
        string s = "Hello";
        string up = s.ToUpper();
        int n = s.Length;
        string rep = s.Replace("l", "L");
        bool has = s.Contains("ell");
        string[] parts = s.Split(',');
        string sub = s.Substring(0, 2);
        string trimmed = s.Trim();
        if (scores.TryGetValue("a", out int v))
        {
            Debug.Log(v);
        }
        foreach (string key in scores.Keys)
        {
            Debug.Log(key);
        }
        foreach (KeyValuePair<string, int> kv in scores)
        {
            Debug.Log(kv.Key + kv.Value);
        }
        transform.SetParent(null);
        Transform child = transform.GetChild(0);
        int cc = transform.childCount;
        gameObject.tag = "Player";
        hp = Mathf.Max(0, hp - 1);
        hp = Mathf.Clamp(hp, 0, 10);
        float d = Vector3.Distance(transform.position, Vector3.zero);
        transform.rotation = Quaternion.identity;
        GetComponent<Renderer>().material.color = Color.red;
        Destroy(gameObject, 1f);
        print("done");
        return;
    }

    void Spawn()
    {
    }

    void OnTriggerEnter2D(Collider2D other)
    {
        if (other.CompareTag("Coin"))
        {
            Destroy(other.gameObject);
        }
    }

    void OnCollisionEnter(Collision collision)
    {
        Debug.Log(collision.gameObject.name);
    }

    void OnMouseDown()
    {
        hp--;
    }
}
